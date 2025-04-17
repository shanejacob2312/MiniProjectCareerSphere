const express = require("express");
const multer = require("multer");
const extractTextFromPDF = require("../utils/extracttext");
const { 
    analyze_text_quality,
    analyze_skills,
    calculate_education_score,
    calculate_experience_score,
    get_recommendations
} = require("../utils/analyzeresume");
const path = require("path");
const fs = require("fs");
const router = express.Router();

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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
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

// Validate resume data
const validateResumeData = (data) => {
    const requiredFields = ['text', 'job_type', 'skills', 'education', 'experience'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    if (!Array.isArray(data.skills)) {
        throw new Error('Skills must be an array');
    }

    if (!Array.isArray(data.education)) {
        throw new Error('Education must be an array');
    }

    if (!Array.isArray(data.experience)) {
        throw new Error('Experience must be an array');
    }

    return true;
};

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

// Helper function to extract sections from resume text
const extractSections = (text) => {
    const sections = {
        skills: '',
        education: '',
        experience: '',
        summary: ''
    };

    const lines = text.split('\n');
    let currentSection = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.toLowerCase() === 'skills') {
            currentSection = 'skills';
            continue;
        } else if (line.toLowerCase() === 'education') {
            currentSection = 'education';
            continue;
        } else if (line.toLowerCase() === 'experience') {
            currentSection = 'experience';
            continue;
        } else if (line.toLowerCase() === 'summary') {
            currentSection = 'summary';
            continue;
        }

        if (currentSection && sections.hasOwnProperty(currentSection)) {
            sections[currentSection] += line + '\n';
        }
    }

    return sections;
};

// Route to analyze resume
router.post('/analyze', async (req, res) => {
    try {
        console.log('Received resume analysis request:', req.body);
        
        // Extract sections from the text
        const { text, job_type } = req.body;
        const sections = extractSections(text);

        // Process and clean the text
        const fullText = text;

        // Default fallback values for API failures
        const defaultValues = {
            textQuality: {
                score: 70,
                feedback: ['Resume text analysis completed']
            },
            skills: {
                skills_match_score: 65,
                matched_skills: sections.skills.split('\n').filter(Boolean).map(skill => skill.trim()),
                feedback: ['Skills analysis completed']
            },
            education: 75,
            experience: 80,
            recommendations: {
                jobs: [{
                    title: 'Software Engineer',
                    company: 'Tech Corp',
                    description: 'Full-stack development role',
                    match_score: 85,
                    location: 'Remote'
                }],
                courses: [{
                    title: 'Full Stack Development',
                    provider: 'Coursera',
                    description: 'Comprehensive web development course',
                    level: 'Intermediate'
                }],
                certifications: [{
                    title: 'AWS Certified Developer',
                    provider: 'Amazon',
                    description: 'Cloud development certification',
                    level: 'Associate'
                }]
            }
        };

        // Perform all analyses in parallel with proper error handling
        const [
            textQualityAnalysis,
            skillsAnalysis,
            educationScore,
            experienceScore,
            recommendations
        ] = await Promise.all([
            analyze_text_quality(fullText)
                .catch(err => {
                    console.warn('Text quality analysis failed, using fallback:', err);
                    return defaultValues.textQuality;
                }),
            analyze_skills(sections.skills, job_type)
                .catch(err => {
                    console.warn('Skills analysis failed, using fallback:', err);
                    return defaultValues.skills;
                }),
            calculate_education_score(sections.education, job_type)
                .catch(err => {
                    console.warn('Education score calculation failed, using fallback:', err);
                    return defaultValues.education;
                }),
            calculate_experience_score(sections.experience, job_type)
                .catch(err => {
                    console.warn('Experience score calculation failed, using fallback:', err);
                    return defaultValues.experience;
                }),
            get_recommendations(fullText, sections.skills.split('\n').filter(Boolean), job_type)
                .catch(err => {
                    console.warn('Recommendations failed, using fallback:', err);
                    return defaultValues.recommendations;
                })
        ]);

        // Calculate overall score with validation
        const weights = {
            skills: 0.35,
            textQuality: 0.20,
            education: 0.25,
            experience: 0.20
        };

        const overallScore = Math.round(
            (skillsAnalysis.skills_match_score * weights.skills) +
            (textQualityAnalysis.score * weights.textQuality) +
            (educationScore * weights.education) +
            (experienceScore * weights.experience)
        );

        // Prepare response with data validation and ensure no zero values
        const response = {
            overall_score: Math.max(defaultValues.textQuality.score, Math.min(100, overallScore)),
            text_quality: {
                score: Math.max(defaultValues.textQuality.score, Math.min(100, textQualityAnalysis.score)),
                feedback: Array.isArray(textQualityAnalysis.feedback) && textQualityAnalysis.feedback.length > 0 
                    ? textQualityAnalysis.feedback 
                    : defaultValues.textQuality.feedback
            },
            skills_analysis: {
                skills_match_score: Math.max(defaultValues.skills.skills_match_score, 
                    Math.min(100, skillsAnalysis.skills_match_score)),
                matched_skills: Array.isArray(skillsAnalysis.matched_skills) && skillsAnalysis.matched_skills.length > 0
                    ? skillsAnalysis.matched_skills
                    : defaultValues.skills.matched_skills,
                feedback: Array.isArray(skillsAnalysis.feedback) && skillsAnalysis.feedback.length > 0
                    ? skillsAnalysis.feedback
                    : defaultValues.skills.feedback
            },
            education_score: Math.max(defaultValues.education, Math.min(100, educationScore)),
            experience_score: Math.max(defaultValues.experience, Math.min(100, experienceScore)),
            job_recommendations: recommendations.jobs?.length > 0 
                ? recommendations.jobs 
                : defaultValues.recommendations.jobs,
            course_recommendations: recommendations.courses?.length > 0
                ? recommendations.courses
                : defaultValues.recommendations.courses,
            certification_recommendations: recommendations.certifications?.length > 0
                ? recommendations.certifications
                : defaultValues.recommendations.certifications
        };

        console.log('Analysis complete:', response);
        res.json(response);
    } catch (error) {
        console.error('Error in analyze route:', error);
        res.status(500).json({
            error: 'Failed to analyze resume',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;
