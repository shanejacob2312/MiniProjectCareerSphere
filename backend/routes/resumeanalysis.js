const express = require("express");
const multer = require("multer");
const extractTextFromPDF = require("../utils/extracttext");
const { 
    analyze_text_quality,
    analyze_skills,
    calculate_education_score,
    calculate_experience_score
} = require("../utils/analyzeresume");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const fetch = require('node-fetch');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created uploads directory:', uploadDir);
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

// Route to extract text from PDF
router.post("/extracttext", upload.single("resume"), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    filePath = req.file.path;
    console.log("Processing file:", {
      path: filePath,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    const text = await extractTextFromPDF(filePath);

    if (!text || text.trim().length === 0) {
      throw new Error("No text could be extracted from the PDF");
    }

    res.json({ text });
  } catch (error) {
    console.error("Error in extracttext route:", error);
    res.status(500).json({ 
      error: error.message || "Failed to extract text from PDF",
      details: error.stack
    });
  } finally {
    // Clean up the uploaded file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log("File cleaned up successfully:", filePath);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }
  }
});

// Function to get recommendations using HuggingFace
async function getRecommendationsFromHuggingFace(jobType, skills) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds
    
    // Using smaller, more reliable models
    const models = [
        "gpt2",               // Most reliable for text generation
        "distilgpt2",        // Faster backup option
        "EleutherAI/gpt-neo-125m" // Good balance of size and quality
    ];

    for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
        for (const model of models) {
            try {
                console.log(`Attempt ${retryCount + 1} with model ${model}`);
                
                // Clean and filter skills for better prompt
                const cleanSkills = skills
                    .filter(skill => skill.length > 2 && !skill.includes('.'))
                    .map(skill => skill.trim())
                    .join(", ");
                
                console.log('Using skills for prompt:', cleanSkills);
                
                // Simpler prompt that's easier for smaller models to handle
                const prompt = `As a career advisor, recommend courses and certifications for a ${jobType} with skills in ${cleanSkills}.

Courses:
1. Advanced Backend Development - Coursera
Description: Master modern backend development practices
Level: Advanced
Link: coursera.org/backend

2. System Design Patterns - Udemy
Description: Learn scalable system design
Level: Intermediate
Link: udemy.com/system-design

3. Cloud Architecture - AWS Training
Description: Build cloud-native applications
Level: Advanced
Link: aws.training/cloud

Certifications:
1. AWS Certified Developer - Amazon
Description: Professional cloud development certification
Level: Professional
Link: aws.amazon.com/certification

2. Oracle Java Professional - Oracle
Description: Enterprise Java development certification
Level: Professional
Link: oracle.com/java/certification

3. Microsoft Azure Developer - Microsoft
Description: Cloud development certification
Level: Associate
Link: microsoft.com/azure/certification

Continue with similar recommendations:`;

                console.log('Sending request to HuggingFace API with prompt:', prompt);
                
                const response = await fetch(
                    `https://api-inference.huggingface.co/models/${model}`,
                    {
                        headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`
                        },
                        method: "POST",
                        body: JSON.stringify({
                            inputs: prompt,
                            parameters: {
                                max_new_tokens: 200,
                                temperature: 0.7,
                                top_p: 0.95,
                                do_sample: true,
                                num_return_sequences: 1
                            }
                        }),
                    }
                );

                console.log('API response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`HuggingFace API error with model ${model}:`, response.status, errorText);
                    continue; // Try next model
                }

                const result = await response.json();
                console.log('Raw HuggingFace API response:', result);

                if (!Array.isArray(result) || !result[0]?.generated_text) {
                    console.error(`Invalid response format from model ${model}`);
                    continue; // Try next model
                }

                const generatedText = result[0].generated_text;
                console.log('Generated text:', generatedText);

                // Parse the recommendations into structured format
                const recommendations = {
                    courses: [],
                    certifications: []
                };

                // Function to ensure provider diversity
                const ensureProviderDiversity = (items) => {
                    const providers = new Map(); // Track providers and their best items
                    const result = [];

                    // Sort items by quality of description and completeness
                    items.sort((a, b) => {
                        const scoreA = (a.description?.length || 0) + (a.level ? 1 : 0) + (a.link?.length || 0);
                        const scoreB = (b.description?.length || 0) + (b.level ? 1 : 0) + (b.link?.length || 0);
                        return scoreB - scoreA;
                    });

                    // First pass: add highest quality item from each provider
                    for (const item of items) {
                        const provider = item.provider.toLowerCase();
                        if (!providers.has(provider)) {
                            providers.set(provider, item);
                            result.push(item);
                        }
                    }

                    // Second pass: add remaining high-quality items if we need more
                    if (result.length < 3) {
                        for (const item of items) {
                            const key = `${item.title}_${item.provider}`.toLowerCase();
                            if (!result.some(r => `${r.title}_${r.provider}`.toLowerCase() === key)) {
                                result.push(item);
                                if (result.length >= 5) break;
                            }
                        }
                    }

                    return result;
                };

                // Helper function to extract items
                const extractItems = (text, type) => {
                    const items = [];
                    const seenKeys = new Set();
                    const regex = new RegExp(`\\d+\\.\\s*([^-\\n]+)-\\s*([^\\n]+)(?:\\nDescription:\\s*([^\\n]+))?(?:\\nLevel:\\s*([^\\n]+))?(?:\\nLink:\\s*([^\\n]+))?`, 'g');
                    let match;
                    
                    while ((match = regex.exec(text)) !== null) {
                        const title = match[1]?.trim();
                        const provider = match[2]?.trim();
                        
                        // Skip if title or provider is invalid or already seen
                        if (!title || !provider || title.includes('[') || provider.includes('[') || 
                            title === 'Course Name' || provider === 'Provider') {
                            continue;
                        }

                        // Create unique key from title and provider
                        const key = `${title}_${provider}`.toLowerCase();
                        if (seenKeys.has(key)) {
                            continue; // Skip duplicates
                        }
                        seenKeys.add(key);

                        items.push({
                            title: title,
                            provider: provider,
                            description: match[3] ? match[3].trim() : `${type} from ${provider}`,
                            level: match[4] ? match[4].trim() : 'Professional',
                            link: match[5] ? match[5].trim() : `https://www.google.com/search?q=${encodeURIComponent(title + ' ' + provider)}`
                        });
                    }
                    
                    // Ensure provider diversity and limit to top 5
                    return ensureProviderDiversity(items).slice(0, 5);
                };

                // Extract courses and certifications
                const coursesSection = generatedText.match(/Courses:[\s\S]*?(?=Certifications:|$)/);
                const certificationsSection = generatedText.match(/Certifications:[\s\S]*$/);

                if (coursesSection) {
                    recommendations.courses = extractItems(coursesSection[0], 'Course');
                }
                if (certificationsSection) {
                    recommendations.certifications = extractItems(certificationsSection[0], 'Certification');
                }

                // Validate we got actual recommendations (not just template text)
                const hasValidRecommendations = (items) => {
                    return items.some(item => 
                        !item.title.includes('[') && 
                        !item.provider.includes('[') && 
                        item.title !== 'Course Name' &&
                        item.provider !== 'Provider'
                    );
                };

                if (hasValidRecommendations(recommendations.courses) || hasValidRecommendations(recommendations.certifications)) {
                    console.log('Successfully parsed recommendations:', recommendations);
                    return recommendations;
                }

                console.error('Failed to parse valid recommendations from response');
                continue; // Try next model

            } catch (error) {
                console.error(`Error with model ${model}:`, error);
                continue; // Try next model
            }
        }

        if (retryCount < MAX_RETRIES - 1) {
            console.log(`All models failed, waiting ${RETRY_DELAY}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }

    throw new Error('Failed to generate recommendations after all retries');
}

// Route to analyze resume
router.post('/analyze', async (req, res) => {
    try {
        console.log('Received resume analysis request:', req.body);
        const { text, job_type, skills, education, experience, location } = req.body;

        // Analyze text quality
        console.log('Analyzing text quality...');
        const text_quality = analyze_text_quality(text);
        console.log('Text quality analysis result:', text_quality);
        
        // Analyze skills
        console.log('Analyzing skills...');
        const skills_analysis = analyze_skills(skills, job_type);
        console.log('Skills analysis result:', skills_analysis);
        
        // Calculate education and experience scores
        console.log('Calculating education score...');
        const education_score = calculate_education_score(education);
        console.log('Education score:', education_score);

        console.log('Calculating experience score...');
        const experience_score = calculate_experience_score(experience);
        console.log('Experience score:', experience_score);
        
        // Get AI recommendations
        console.log('Getting AI recommendations...');
        const recommendations = await getRecommendationsFromHuggingFace(job_type, skills);
        console.log('AI recommendations:', recommendations);
        
        // Calculate overall score
        const overall_score = Math.round(
            text_quality.readability_score * 0.2 +
            skills_analysis.skills_match_score * 0.3 +
            education_score * 0.25 +
            experience_score * 0.25
        );

        // Generate job recommendations based on skills and experience
        const job_recommendations = [
            {
                title: 'Senior Software Engineer',
                company: 'Tech Innovation Corp',
                location: location || 'Remote',
                match_percentage: Math.min(95, Math.round(skills_analysis.skills_match_score)),
                description: 'Lead development of cloud-native applications and mentor junior developers.',
                required_skills: skills_analysis.matched_skills.slice(0, 5)
            },
            {
                title: 'Full Stack Developer',
                company: 'Digital Solutions Inc',
                location: location || 'Remote',
                match_percentage: Math.min(90, Math.round(skills_analysis.skills_match_score)),
                description: 'Develop full-stack applications using React and Node.js.',
                required_skills: skills_analysis.matched_skills.slice(0, 5)
            },
            {
                title: 'Backend Developer',
                company: 'Cloud Systems Ltd',
                location: location || 'Remote',
                match_percentage: Math.min(85, Math.round(skills_analysis.skills_match_score)),
                description: 'Build scalable backend services and APIs.',
                required_skills: skills_analysis.matched_skills.slice(0, 5)
            }
        ];

        const response = {
            overall_score,
            text_quality: {
                score: text_quality.readability_score,
                readability: text_quality.readability_level,
                clarity: text_quality.clarity_level,
                suggestions: text_quality.suggestions
            },
            skills_analysis: {
                matched_skills: skills_analysis.matched_skills || [],
                missing_skills: skills_analysis.missing_skills || [],
                skills_match_score: skills_analysis.skills_match_score || 0
            },
            education_score,
            experience_score,
            job_recommendations,
            course_recommendations: recommendations?.courses || [],
            certification_recommendations: recommendations?.certifications || []
        };

        console.log('Sending analysis response:', response);
        res.json(response);
        
    } catch (error) {
        console.error('Error in analyze route:', error);
        res.status(500).json({ error: error.message || 'Failed to analyze resume' });
    }
  });
  
module.exports = router;
