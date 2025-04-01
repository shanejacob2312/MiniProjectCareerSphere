const { pipeline, env } = require('@xenova/transformers');
const natural = require("natural");
const { NlpManager } = require('node-nlp');
const nlp = require('compromise');
const jobMarketService = require('../services/jobMarketService');
const https = require('https');
const axios = require('axios');

// Configure transformers with better network settings
env.backends.onnx.wasm.numThreads = 2;
env.useBrowserCache = false;
env.allowLocalModels = true;
env.localModelPath = './models';
env.cacheDir = './cache';
env.useNodeFetch = true;
env.fallbackToCPU = true;
env.localModelPath = process.env.LOCAL_MODEL_PATH || './models';
env.proxyAgent = process.env.HTTPS_PROXY;

// Add retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// Add network timeout settings
const NETWORK_TIMEOUT = 30000;

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to download with retry
async function downloadWithRetry(url, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                timeout: NETWORK_TIMEOUT,
                httpsAgent: new https.Agent({ 
                    rejectUnauthorized: false,
                    timeout: NETWORK_TIMEOUT
                }),
                proxy: process.env.HTTPS_PROXY
            });
            return response.data;
        } catch (error) {
            console.error(`Download attempt ${i + 1} failed:`, error.message);
            if (i === retries - 1) throw error;
            await delay(RETRY_DELAY * (i + 1));
        }
    }
}

// Initialize NLP Manager
const manager = new NlpManager({ languages: ['en'] });

// Basic skill extraction without AI
function basicSkillExtraction(text) {
    const skills = new Map();
    const commonSkills = [
        'javascript', 'python', 'java', 'c++', 'react', 'node.js', 'sql',
        'html', 'css', 'aws', 'docker', 'kubernetes', 'git', 'agile',
        'machine learning', 'data analysis', 'project management',
        'typescript', 'angular', 'vue.js', 'mongodb', 'postgresql',
        'rest api', 'graphql', 'ci/cd', 'devops', 'cloud computing',
        'microservices', 'testing', 'debugging', 'problem solving'
    ];
    
    // Check for exact matches first
    commonSkills.forEach(skill => {
        if (text.toLowerCase().includes(skill.toLowerCase())) {
            // Calculate proficiency based on context
            const proficiency = calculateProficiencyFromContext(text, skill);
            skills.set(skill.toLowerCase(), {
                skill: skill,
                proficiency: proficiency,
                source: 'basic'
            });
        }
    });
    
    return Array.from(skills.values());
}

// Helper function to calculate proficiency from context
function calculateProficiencyFromContext(text, skill) {
    const context = text.toLowerCase();
    const skillContext = context.substring(
        Math.max(0, context.indexOf(skill.toLowerCase()) - 50),
        Math.min(context.length, context.indexOf(skill.toLowerCase()) + skill.length + 50)
    );
    
    // Check for expertise indicators
    if (skillContext.match(/expert|senior|lead|architect|advanced|master/)) {
        return 'expert';
    }
    if (skillContext.match(/experienced|proficient|skilled|strong/)) {
        return 'advanced';
    }
    return 'intermediate';
}

// Initialize models
let classifier = null;
let skillsExtractor = null;
let modelsLoaded = false;
let modelLoadingPromise = null;

// Load models with proper initialization
async function loadModels() {
    if (modelLoadingPromise) {
        return modelLoadingPromise;
    }

    modelLoadingPromise = (async () => {
        try {
            console.log('Starting model initialization...');
            
            // Use a simpler model that's more reliable
            const classifierPromise = pipeline('text-classification', 'Xenova/distilbert-base-uncased', {
                quantized: true,
                revision: 'main',
                cache_dir: './cache',
                local: true,
                fallbackToCPU: true
            }).catch(error => {
                console.error('Classifier loading failed:', error);
                return null;
            });

            // Load classifier first
            classifier = await classifierPromise;
            
            if (classifier) {
                console.log('✅ Classifier loaded successfully');
                modelsLoaded = true;
                
                // Try loading extractor only if classifier succeeded
                try {
                    skillsExtractor = await pipeline('token-classification', 'Xenova/bert-base-uncased', {
                        quantized: true,
                        revision: 'main',
                        cache_dir: './cache',
                        local: true,
                        fallbackToCPU: true
                    });
                    console.log('✅ Skill extractor loaded successfully');
                } catch (extractorError) {
                    console.warn('Skill extractor loading failed, will use basic extraction:', extractorError.message);
                    skillsExtractor = null;
                }
            } else {
                throw new Error('Failed to load classifier model');
            }

            return true;
        } catch (error) {
            console.error('Error loading AI models:', error);
            // Reset state on failure
            classifier = null;
            skillsExtractor = null;
            modelsLoaded = false;
            modelLoadingPromise = null;
            throw error;
        }
    })();

    return modelLoadingPromise;
}

// Modified analyze function to work with partial model availability
async function analyzeText(text) {
    if (!text || typeof text !== 'string') {
        return { skills: [], sentiment: 'neutral' };
    }

    // Always get basic skills
    const basicSkills = basicSkillExtraction(text);
    
    try {
        // Try AI analysis if classifier is available
        if (classifier) {
            const sentiment = await classifier(text);
            return {
                skills: basicSkills,
                sentiment: sentiment[0].label
            };
        }
    } catch (error) {
        console.warn('AI analysis failed, using basic analysis:', error.message);
    }
    
    // Fallback to basic analysis
    return {
        skills: basicSkills,
        sentiment: 'neutral'
    };
}

// Main resume analysis function
async function analyzeResume(resumeData) {
    try {
        // Parse the text into structured data
        const parsedData = parseResumeText(resumeData);
        
        // Extract skills using enhanced extraction
        const extractedSkills = await extractSkillsWithProficiency(parsedData.fullText);
        console.log('Extracted skills:', extractedSkills);
        
        // Calculate scores
        const textQuality = analyzeTextQuality(parsedData.fullText);
        const experienceScore = calculateExperienceFromText(parsedData.experience);
        const educationScore = calculateEducationFromText(parsedData.education);

        // Get job type and required skills
        const jobType = determineJobType(extractedSkills.map(s => s.skill)) || 'Software Developer';
        const requiredSkills = [
            'JavaScript', 'Python', 'SQL', 'Git', 'Problem Solving',
            'React', 'Node.js', 'HTML', 'CSS', 'REST APIs'
        ];

        // Calculate skill matches
        const matchedSkills = extractedSkills.filter(skill => 
            requiredSkills.some(req => 
                req.toLowerCase().includes(skill.skill.toLowerCase()) ||
                skill.skill.toLowerCase().includes(req.toLowerCase())
            )
        );

        const missingSkills = requiredSkills.filter(req =>
            !extractedSkills.some(skill => 
                req.toLowerCase().includes(skill.skill.toLowerCase()) ||
                skill.skill.toLowerCase().includes(req.toLowerCase())
            )
        );

        // Calculate match percentage
        const skillMatch = Math.round((matchedSkills.length / requiredSkills.length) * 100);

        // Calculate skill level based on experience and matched skills
        const skillLevel = determineSkillLevel(parsedData, {
            matched_skills: matchedSkills,
            missing_skills: missingSkills
        });

        // Calculate expertise level based on matched skills proficiency
        const expertSkills = matchedSkills.filter(s => s.proficiency === 'expert').length;
        const advancedSkills = matchedSkills.filter(s => s.proficiency === 'advanced').length;
        const totalSkills = matchedSkills.length;
        
        const expertiseRatio = totalSkills > 0 ? 
            ((expertSkills * 3) + (advancedSkills * 2)) / (totalSkills * 3) : 0;

        // Determine course level based on expertise ratio and experience
        const courseLevel = expertiseRatio >= 0.7 || experienceScore >= 80 ? 'Advanced' :
                          expertiseRatio >= 0.4 || experienceScore >= 60 ? 'Intermediate' :
                          'Beginner';

        // Get recommendations
        const recommendations = {
            jobs: [{
                title: 'Software Developer',
                match_percentage: skillMatch,
                level: experienceScore >= 80 ? 'Senior' : 
                       experienceScore >= 60 ? 'Mid-Level' : 
                       experienceScore >= 40 ? 'Junior' : 'Entry Level',
                salary_range: experienceScore >= 60 ? '$80,000 - $150,000' : '$50,000 - $80,000',
                required_skills: requiredSkills,
                growth_potential: 'High',
                market_demand: 'High',
                description: 'Software development position focusing on full-stack development with modern technologies.'
            }],
            courses: [
                // Advanced courses for missing skills
                ...missingSkills.slice(0, 2).map(skill => ({
                    title: `${skill} ${courseLevel} Training`,
                    provider: 'Coursera',
                    description: courseLevel === 'Advanced' ?
                        `Master advanced ${skill} concepts and architectural patterns` :
                        courseLevel === 'Intermediate' ?
                        `Build professional ${skill} applications with best practices` :
                        `Learn ${skill} fundamentals with hands-on practice`,
                    level: courseLevel,
                    match_score: 100,
                    link: `https://www.coursera.org/courses?query=${encodeURIComponent(skill)}`,
                    estimated_duration: courseLevel === 'Advanced' ? '10-12 weeks' :
                                     courseLevel === 'Intermediate' ? '8-10 weeks' : '6-8 weeks',
                    prerequisites: courseLevel === 'Advanced' ? 
                        'Strong programming fundamentals and some professional experience required' :
                        courseLevel === 'Intermediate' ?
                        'Basic programming knowledge and some project experience required' :
                        'No prerequisites required'
                })),
                // Skill enhancement courses for matched skills
                ...matchedSkills.slice(0, 1).map(skill => ({
                    title: `Advanced ${skill.skill} Mastery`,
                    provider: 'Udemy',
                    description: `Advanced ${skill.skill} techniques, design patterns, and enterprise best practices`,
                    level: 'Advanced',
                    match_score: 95,
                    link: `https://www.udemy.com/courses?q=${encodeURIComponent(skill.skill)}+advanced`,
                    estimated_duration: '12-14 weeks',
                    prerequisites: 'Professional experience with the technology required'
                }))
            ],
            certifications: [
                {
                    title: 'AWS Certified Developer',
                    provider: 'Amazon',
                    description: 'Professional certification for cloud development',
                    level: 'Associate',
                    match_score: 85,
                    link: 'https://aws.amazon.com/certification/certified-developer-associate'
                },
                {
                    title: 'Professional Scrum Developer',
                    provider: 'Scrum.org',
                    description: 'Certification for agile software development',
                    level: 'Professional',
                    match_score: 80,
                    link: 'https://www.scrum.org/professional-scrum-developer'
                }
            ]
        };

        const result = {
            skills: extractedSkills,
            text_quality: {
                readability_score: textQuality,
                sentence_count: parsedData.fullText.split(/[.!?]+/).length,
                word_count: parsedData.fullText.split(/\s+/).length,
                avg_word_length: (parsedData.fullText.replace(/\s+/g, '').length / parsedData.fullText.split(/\s+/).length).toFixed(2)
            },
            experience_score: experienceScore,
            education_score: educationScore,
            skill_match: skillMatch,
            skills_analysis: {
                matched_skills: matchedSkills.map(s => ({
                    name: s.skill,
                    proficiency: s.proficiency || 'intermediate',
                    source: s.source || 'resume'
                })),
                missing_skills: missingSkills.map(skill => ({
                    name: skill,
                    importance: 'required',
                    market_demand: 'high'
                })),
                skill_scores: {
                    total: skillMatch,
                    confidence: 0.85
                }
            },
            job_recommendations: recommendations.jobs,
            course_recommendations: recommendations.courses,
            certification_recommendations: recommendations.certifications,
            overall_score: calculateOverallScore({
                textQuality,
                skillMatch,
                experienceScore,
                educationScore
            })
        };

        console.log('Resume analysis completed successfully:', {
            skillsFound: extractedSkills.length,
            skillsMatched: matchedSkills.length,
            skillsMissing: missingSkills.length,
            overallScore: result.overall_score
        });

        return result;
    } catch (error) {
        console.error('Error in analyzeResume:', error);
        throw error;
    }
}

function calculateOverallScore({ textQuality, skillMatch, experienceScore, educationScore }) {
    // Weight the different components
    const weights = {
        textQuality: 0.2,
        skillMatch: 0.3,
        experience: 0.25,
        education: 0.25
    };

    // Calculate weighted score
    const weightedScore = (
        (textQuality * weights.textQuality) +
        (skillMatch * weights.skillMatch) +
        (experienceScore * weights.experience) +
        (educationScore * weights.education)
    );

    // Round to nearest integer and ensure it's between 0 and 100
    return Math.min(100, Math.max(0, Math.round(weightedScore)));
}

// Helper function to parse resume text
function parseResumeText(resumeData) {
    let text = '';
    if (typeof resumeData === 'string') {
        text = resumeData;
    } else if (typeof resumeData === 'object' && resumeData !== null) {
        text = resumeData.text || resumeData.content || resumeData.resume || '';
    }
    
    text = text.trim();
    
    // Split into sections
    const sections = text.split(/\n(?=[A-Z][a-zA-Z\s]+:?\n)/);
    
    const experience = sections.find(s => /experience|work history/i.test(s)) || '';
    const education = sections.find(s => /education|academic/i.test(s)) || '';
    const skills = sections.find(s => /skills|technical/i.test(s)) || '';
    
    return {
        fullText: text,
        experience,
        education,
        skills
    };
}

// Helper function to calculate experience from text
function calculateExperienceFromText(text) {
    try {
        // Look for years of experience
        const yearsMatches = text.match(/(\d+)[\s-]*years?/g) || [];
        const years = yearsMatches.map(y => parseInt(y)).filter(y => y > 0);
        
        // Look for date ranges
        const dateRanges = text.match(/(\d{4})\s*-\s*(\d{4}|present|current)/gi) || [];
        const dateYears = dateRanges.map(range => {
            const [start, end] = range.split(/\s*-\s*/i);
            const endYear = end.toLowerCase() === 'present' || end.toLowerCase() === 'current' 
                ? new Date().getFullYear() 
                : parseInt(end);
            return endYear - parseInt(start);
        }).filter(y => y > 0);

        // Calculate total years
        const totalYears = Math.max(...[...years, ...dateYears, 0]);
        
        // Calculate score based on years
        let score = Math.min(100, totalYears * 10);
        
        // Add bonuses for senior titles
        if (/senior|lead|principal|architect/i.test(text)) {
            score += 20;
        }
        
        return Math.min(100, score);
    } catch (error) {
        console.error('Error calculating experience:', error);
        return 0;
    }
}

// Helper function to calculate education from text
function calculateEducationFromText(text) {
    try {
        let score = 0;
        
        // Check for degree levels
        if (/ph\.?d|doctorate/i.test(text)) score += 100;
        else if (/master'?s|mba|ms|ma/i.test(text)) score += 80;
        else if (/bachelor'?s|bs|ba|b\.?tech/i.test(text)) score += 60;
        else if (/associate'?s|diploma/i.test(text)) score += 40;
        
        // Add bonus for prestigious schools
        if (/stanford|mit|harvard|berkeley|oxford|cambridge/i.test(text)) {
            score += 20;
        }
        
        // Add bonus for relevant fields
        if (/computer|software|information|data|engineering/i.test(text)) {
            score += 10;
        }
        
        return Math.min(100, score);
    } catch (error) {
        console.error('Error calculating education:', error);
        return 0;
    }
}

// Helper function to get default job recommendations
function getDefaultJobRecommendations(jobType, skillMatch, experienceScore) {
    const level = experienceScore >= 80 ? 'Senior' :
                 experienceScore >= 60 ? 'Mid-Level' :
                 experienceScore >= 40 ? 'Junior' : 'Entry Level';
    
    return [{
        title: `${level} ${jobType}`,
        match_percentage: skillMatch,
        level: level.toLowerCase(),
        salary_range: `${level} Level ($${experienceScore >= 60 ? '80,000' : '50,000'} - $${experienceScore >= 60 ? '150,000' : '80,000'})`,
        required_skills: jobRequirements[jobType]?.required_skills || [],
        growth: 'High',
        demand: 'High'
    }];
}

// Helper function to get default course recommendations
function getDefaultCourseRecommendations(missingSkills) {
    return missingSkills.slice(0, 3).map(skill => ({
        title: `${skill} Essential Training`,
        provider: 'Coursera',
        description: `Master ${skill} through hands-on projects and exercises`,
        level: 'Beginner',
        match_percentage: 100,
        url: `https://www.coursera.org/courses?query=${encodeURIComponent(skill)}`
    }));
}

// Helper function to get default certification recommendations
function getDefaultCertificationRecommendations(jobType) {
    const certifications = jobRequirements[jobType]?.certifications || DEFAULT_RESPONSE.certification_recommendations;
    return certifications.map(cert => {
        if (typeof cert === 'string') {
            return {
                title: cert,
                provider: cert.split(' ')[0],
                description: `Professional certification for ${jobType}`,
                level: 'Associate',
                url: `https://www.google.com/search?q=${encodeURIComponent(cert)}+certification`
            };
        }
        return cert;
    });
}

// Helper function to determine job type from skills
function determineJobType(skills) {
    const skillNames = skills.map(s => s.toLowerCase());
    
    // Count skills in each category
    const counts = {
        'Frontend Developer': ['react', 'angular', 'vue', 'javascript', 'html', 'css'].filter(s => 
            skillNames.some(skill => skill.includes(s))).length,
        'Backend Developer': ['node', 'python', 'java', 'php', 'sql', 'mongodb'].filter(s => 
            skillNames.some(skill => skill.includes(s))).length,
        'Data Scientist': ['python', 'r', 'machine learning', 'statistics', 'sql'].filter(s => 
            skillNames.some(skill => skill.includes(s))).length,
        'Data Engineer': ['sql', 'python', 'etl', 'hadoop', 'spark'].filter(s => 
            skillNames.some(skill => skill.includes(s))).length
    };
    
    // Find the job type with the most matching skills
    const [jobType] = Object.entries(counts)
        .sort(([,a], [,b]) => b - a)[0] || ['Software Developer', 0];
    
    return jobType;
}

// Update module exports
module.exports = {
    analyzeResume,
    loadModels,
    extractSkillsWithProficiency,
    analyzeText,
    getModelStatus: () => ({
        modelsLoaded,
        classifierAvailable: !!classifier,
        extractorAvailable: !!skillsExtractor
    })
};

// Add comprehensive skills dictionary by industry
const skillsDictionary = {
  technology: [
    // Programming Languages
    'python', 'java', 'javascript', 'c++', 'c#', 'ruby', 'php', 'swift',
    // Web Technologies
    'react', 'angular', 'node', 'html', 'css', 'web development',
    // Databases
    'sql', 'mongodb', 'postgresql', 'mysql'
  ],
  business: [
    'marketing', 'sales', 'accounting', 'finance', 'budgeting', 'project management',
    'microsoft office', 'excel', 'powerpoint', 'quickbooks', 'crm', 'salesforce',
    'market research', 'business development', 'strategic planning'
  ],
  healthcare: [
    'patient care', 'medical records', 'hipaa', 'electronic health records', 'ehr',
    'clinical', 'medical terminology', 'vital signs', 'patient assessment',
    'healthcare management', 'medical coding', 'medical billing'
  ],
  education: [
    'curriculum development', 'lesson planning', 'classroom management',
    'student assessment', 'teaching', 'educational technology', 'special education',
    'instructional design', 'e-learning', 'distance learning'
  ],
  creative: [
    'adobe creative suite', 'photoshop', 'illustrator', 'indesign',
    'graphic design', 'ui/ux design', 'typography', 'branding',
    'video editing', 'content creation', 'social media management'
  ],
  engineering: [
    'autocad', 'solidworks', 'mechanical design', 'electrical engineering',
    'civil engineering', 'structural analysis', 'project planning',
    'quality control', 'manufacturing', '3d modeling'
  ]
};

// Flatten skills dictionary for searching
const allSkills = Object.values(skillsDictionary).flat();

// Load AI models with timeout
async function extractSkillsAI(text) {
    try {
        if (!modelsLoaded || !skillsExtractor) {
            console.log('Using basic keyword extraction (AI models not loaded)');
            return extractKeywords(text);
        }
        
        const entities = await skillsExtractor(text);
        const skills = entities
            .filter(entity => entity.score > 0.8)
            .map(entity => entity.word.replace(/^##/, ''))
            .filter(skill => skill.length > 2);
        
        return [...new Set(skills)];
    } catch (error) {
        console.error('Error in AI skills extraction:', error);
        return extractKeywords(text);
    }
}

// Modify analyzeSentimentAI to handle unloaded models
async function analyzeSentimentAI(text) {
    try {
        if (!modelsLoaded || !classifier) {
            console.log('Using basic sentiment analysis (AI models not loaded)');
            return analyzeSentiment(text);
        }
        
        const result = await classifier(text);
        return {
            score: result[0].score,
            label: result[0].label
        };
    } catch (error) {
        console.error('Error in AI sentiment analysis:', error);
        return analyzeSentiment(text);
    }
}

// Use Word2Vec for skill similarity
const word2vec = new natural.TfIdf();

// Add common skills to word2vec
Object.values(skillsDictionary).flat().forEach(skill => {
  word2vec.addDocument(skill.toLowerCase());
});

// Find similar skills using TF-IDF
function findSimilarSkills(skill, count = 5) {
  const skillName = typeof skill === 'object' ? skill.skill : skill;
  const results = [];
  word2vec.tfidfs(skillName.toLowerCase(), function(i, measure) {
    if (measure > 0) {
      results.push({
        skill: Object.values(skillsDictionary).flat()[i],
        similarity: measure
      });
    }
  });
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, count)
    .map(result => result.skill);
}

// Train the model with some basic patterns
async function trainModel() {
  // Technology patterns
  manager.addDocument('en', 'I know JavaScript programming', 'technology');
  manager.addDocument('en', 'I developed web applications', 'technology');
  
  // Business patterns
  manager.addDocument('en', 'I managed marketing campaigns', 'business');
  manager.addDocument('en', 'I have experience in sales', 'business');
  
  // Healthcare patterns
  manager.addDocument('en', 'I worked in patient care', 'healthcare');
  manager.addDocument('en', 'I have nursing experience', 'healthcare');
  
  // Education patterns
  manager.addDocument('en', 'I taught mathematics', 'education');
  manager.addDocument('en', 'I developed curriculum', 'education');
  
  // Creative patterns
  manager.addDocument('en', 'I designed marketing materials', 'creative');
  manager.addDocument('en', 'I created digital content', 'creative');
  
  // Engineering patterns
  manager.addDocument('en', 'I designed mechanical systems', 'engineering');
  manager.addDocument('en', 'I worked on construction projects', 'engineering');
  
  await manager.train();
  console.log('NLP model trained successfully');
}

// Initialize the model
trainModel();

// Extract Keywords with NLP
const extractKeywords = (text) => {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text);
  const tfidf = new natural.TfIdf();

  tfidf.addDocument(text);
  let keywords = [];

  words.forEach((word) => {
    tfidf.tfidfs(word, (i, measure) => {
      if (measure > 0.2) keywords.push(word);
    });
  });

  return [...new Set(keywords)];
};

// Analyze text sentiment using compromise
const analyzeSentiment = (text) => {
  const doc = nlp(text);
  const terms = doc.terms().out('array');
  const positiveWords = ['excellent', 'great', 'good', 'proficient', 'skilled', 'experienced', 'successful', 'achieved'];
  const negativeWords = ['poor', 'weak', 'lack', 'limited', 'basic', 'simple'];
  
  let sentiment = 0;
  terms.forEach(term => {
    if (positiveWords.includes(term.toLowerCase())) sentiment++;
    if (negativeWords.includes(term.toLowerCase())) sentiment--;
  });

  return {
    score: Math.max(0, Math.min(1, (sentiment + 5) / 10)),
    label: sentiment > 0 ? 'positive' : sentiment < 0 ? 'negative' : 'neutral'
  };
};

// Extract entities using compromise
const extractEntities = (text) => {
  const doc = nlp(text);
  const organizations = doc.organizations().out('array');
  const topics = doc.topics().out('array');
  
  // Extract potential skills using proper nouns and known skills
  const properNouns = doc.match('#ProperNoun+').out('array');
  const skills = properNouns.filter(word => 
    allSkills.some(skill => 
      word.toLowerCase().includes(skill) || 
      skill.includes(word.toLowerCase())
    )
  );

  return {
    organizations,
    topics,
    skills
  };
};

// Add job requirements dictionary
const jobRequirements = {
  "Data Analyst": {
    education: ["Bachelor's in Computer Science", "Statistics", "Mathematics", "Data Science", "Related Technical Field"],
    required_skills: ["SQL", "Python", "Data Analysis", "Statistics", "Excel"],
    preferred_skills: ["R", "Tableau", "Power BI", "Machine Learning", "Data Visualization"],
    experience_level: "0-3 years",
    certifications: ["Google Data Analytics", "IBM Data Analyst", "Microsoft Power BI"]
  },
  "Business Analyst": {
    education: ["Bachelor's in Business", "Computer Science", "Information Systems", "Related Field"],
    required_skills: ["SQL", "Excel", "Data Analysis", "Requirements Gathering", "Business Process"],
    preferred_skills: ["Python", "Tableau", "Agile", "JIRA", "Process Mapping"],
    experience_level: "1-3 years",
    certifications: ["IIBA CBAP", "PMI-PBA", "Agile Analysis Certification"]
  },
  "Data Scientist": {
    education: ["Master's/Bachelor's in Computer Science", "Data Science", "Statistics", "Mathematics"],
    required_skills: ["Python", "Machine Learning", "Statistics", "SQL", "Data Analysis"],
    preferred_skills: ["R", "Deep Learning", "Big Data", "Cloud Platforms", "Data Visualization"],
    experience_level: "2-5 years",
    certifications: ["AWS Machine Learning", "Google Data Science", "IBM Data Science"]
  },
  "Data Engineer": {
    education: ["Bachelor's in Computer Science", "Software Engineering", "Data Science"],
    required_skills: ["Python", "SQL", "ETL", "Data Warehousing", "Big Data"],
    preferred_skills: ["Spark", "Hadoop", "AWS", "Azure", "Docker"],
    experience_level: "2-4 years",
    certifications: ["AWS Data Engineer", "Google Cloud Data Engineer", "Azure Data Engineer"]
  },
  "Frontend Developer": {
    education: ["Bachelor's in Computer Science", "Software Engineering", "Web Development", "Related Technical Field"],
    required_skills: ["HTML", "CSS", "JavaScript", "React", "Responsive Design"],
    preferred_skills: ["TypeScript", "Vue.js", "Angular", "UI/UX Design", "Web Performance"],
    experience_level: "2-5 years",
    certifications: ["AWS Certified Developer", "Google Mobile Web Specialist"]
  },
  "Software Developer": {
    education: ["Bachelor's in Computer Science", "Software Engineering", "Related Technical Field"],
    required_skills: ["JavaScript", "Python", "SQL", "Git", "Problem Solving"],
    preferred_skills: ["React", "Node.js", "AWS", "Docker", "Agile"],
    experience_level: "2-5 years",
    certifications: [
      {
        title: "AWS Certified Developer",
        provider: "Amazon",
        description: "Professional certification for cloud development",
        level: "Associate",
        url: "https://aws.amazon.com/certification/certified-developer-associate"
      },
      {
        title: "Microsoft Azure Developer",
        provider: "Microsoft",
        description: "Certification for cloud application development",
        level: "Associate",
        url: "https://learn.microsoft.com/certifications/azure-developer"
      },
      {
        title: "Professional Scrum Developer",
        provider: "Scrum.org",
        description: "Certification for agile software development",
        level: "Professional",
        url: "https://www.scrum.org/professional-scrum-developer"
      }
    ]
  },
  "Marketing Manager": {
    education: ["Bachelor's in Marketing", "Business Administration", "Communications"],
    required_skills: ["Digital Marketing", "Social Media Management", "Market Research", "Analytics"],
    preferred_skills: ["SEO", "Content Strategy", "Adobe Creative Suite", "Project Management"],
    experience_level: "3-5 years",
    certifications: ["Google Analytics", "HubSpot Marketing"]
  },
  "Registered Nurse": {
    education: ["Bachelor's in Nursing", "Associate's in Nursing"],
    required_skills: ["Patient Care", "Medical Records", "Clinical Procedures", "HIPAA"],
    preferred_skills: ["Critical Care", "Emergency Medicine", "Electronic Health Records"],
    experience_level: "1-3 years",
    certifications: ["RN License", "BLS Certification", "ACLS Certification"]
  },
  "Teacher": {
    education: ["Bachelor's in Education", "Master's in Education"],
    required_skills: ["Classroom Management", "Curriculum Development", "Student Assessment"],
    preferred_skills: ["Special Education", "Educational Technology", "Distance Learning"],
    experience_level: "0-2 years",
    certifications: ["Teaching License", "Special Education Certification"]
  },
  "Graphic Designer": {
    education: ["Bachelor's in Graphic Design", "Visual Arts", "Related Creative Field"],
    required_skills: ["Adobe Creative Suite", "Typography", "Layout Design"],
    preferred_skills: ["UI/UX Design", "Web Design", "Motion Graphics"],
    experience_level: "2-4 years",
    certifications: ["Adobe Certified Professional"]
  },
  "Mechanical Engineer": {
    education: ["Bachelor's in Mechanical Engineering"],
    required_skills: ["CAD Software", "3D Modeling", "Technical Documentation"],
    preferred_skills: ["SolidWorks", "AutoCAD", "Project Management"],
    experience_level: "2-5 years",
    certifications: ["PE License", "Six Sigma Certification"]
  }
};

// Add text quality analysis function
function analyzeTextQuality(text) {
  console.log('Analyzing text quality for text length:', text.length);
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.trim().length > 0);
  const avgWordLength = words.reduce((acc, word) => acc + word.length, 0) / words.length;
  
  // Calculate readability score (simplified Flesch-Kincaid)
  const readabilityScore = Math.min(100, Math.max(0, 
    100 - (words.length / sentences.length) * 2
  ));
  
  console.log('Text quality analysis results:', {
    sentenceCount: sentences.length,
    wordCount: words.length,
    avgWordLength: avgWordLength.toFixed(2),
    readabilityScore
  });
  
  return Math.round(readabilityScore);
}

// Add a default response structure
const DEFAULT_RESPONSE = {
    overall_score: 0,
    text_quality: {
        readability_score: 0,
        sentence_count: 0,
        word_count: 0,
        avg_word_length: '0',
        sentiment_score: 0,
        sentiment_label: 'neutral'
    },
    skills_analysis: {
        score: 0,
        matched_skills: [],
        missing_skills: [],
        market_demand: "Entry Level",
        growth_potential: "Entry Level"
    },
    education_analysis: {
        score: 0,
        recommendations: []
    },
    experience_score: 0,
    job_recommendations: [
        {
            job_title: "Entry Level Position",
            level: "Entry Level",
            match_percentage: 0,
            salary_range: "Entry Level ($40,000 - $60,000)",
            description: "Please provide more information in your resume",
            missing_skills: []
        }
    ],
    course_recommendations: [
        {
            title: "Professional Skills Development",
            provider: "Coursera",
            description: "Build essential professional skills for your career",
            level: "Beginner",
            url: "https://www.coursera.org/professional-skills",
            skill_type: "required",
            estimated_duration: "4-6 weeks",
            price_range: "$49-99",
            rating: 4.5,
            students_enrolled: "10,000+"
        },
        {
            title: "Career Development Fundamentals",
            provider: "Udemy",
            description: "Learn fundamental skills for career growth",
            level: "Beginner",
            url: "https://www.udemy.com/career-development",
            skill_type: "required",
            estimated_duration: "6-8 weeks",
            price_range: "$79-149",
            rating: 4.6,
            students_enrolled: "15,000+"
        }
    ],
    certification_recommendations: [
        {
            title: "Professional Development Certification",
            provider: "PMI",
            description: "Foundational certification for professional development",
            level: "Associate",
            url: "https://www.pmi.org/certifications"
        },
        {
            title: "Career Skills Certificate",
            provider: "LinkedIn Learning",
            description: "Comprehensive career skills certification",
            level: "Professional",
            url: "https://www.linkedin.com/learning"
        }
    ],
    certifications: [
        {
            title: "Professional Development Certification",
            provider: "PMI",
            description: "Foundational certification for professional development",
            level: "Associate",
            url: "https://www.pmi.org/certifications"
        },
        {
            title: "Career Skills Certificate",
            provider: "LinkedIn Learning",
            description: "Comprehensive career skills certification",
            level: "Professional",
            url: "https://www.linkedin.com/learning"
        }
    ]
};

// Enhanced skill extraction with better error handling
async function extractSkillsWithProficiency(text) {
    if (!text || typeof text !== 'string') {
        console.error('Invalid input to extractSkillsWithProficiency:', text);
        return [];
    }

    const skills = new Map(); // Use Map to prevent duplicates
    
    try {
        // Define common non-skill words to filter out
        const nonSkillWords = new Set([
            'the', 'and', 'or', 'in', 'at', 'by', 'for', 'with', 'to', 'from',
            'a', 'an', 'of', 'on', 'is', 'was', 'were', 'be', 'been', 'being',
            'that', 'this', 'these', 'those', 'am', 'is', 'are', 'has', 'have',
            'had', 'up', 'down', 'inc', 'ltd', 'corp', 'corporation', 'through',
            'into', 'after', 'before', 'during', 'following', 'over', 'since',
            'within', 'without', 'under', 'further', 'then', 'once', 'here', 'there',
            'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
            'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so',
            'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now'
        ]);

        // Always start with basic extraction to ensure we have some skills
        const basicExtractedSkills = basicSkillExtraction(text);
        basicExtractedSkills.forEach(skill => {
            if (skill.skill.length > 2 && !nonSkillWords.has(skill.skill.toLowerCase())) {
                skills.set(skill.skill.toLowerCase(), {
                    skill: skill.skill,
                    proficiency: formatProficiency(skill.proficiency),
                    source: 'basic'
                });
            }
        });

        // Try AI extraction if available
        if (modelsLoaded && skillsExtractor) {
            console.log('Using AI for skill extraction...');
            try {
                const aiResult = await Promise.race([
                    skillsExtractor(text),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('AI extraction timeout')), 5000)
                    )
                ]);

                aiResult
                    .filter(entity => entity.score > 0.6)
                    .forEach(entity => {
                        const skillName = entity.word.replace(/^##/, '').trim();
                        // Filter out non-skills and short strings
                        if (skillName.length > 2 && 
                            !nonSkillWords.has(skillName.toLowerCase()) &&
                            !skillName.match(/^[.,\/#!$%\^&\*;:{}=\-_`~()0-9]+$/)) {
                            
                            const proficiency = entity.score > 0.8 ? 'expert' :
                                              entity.score > 0.6 ? 'advanced' :
                                              'intermediate';
                            
                            skills.set(skillName.toLowerCase(), {
                                skill: skillName,
                                proficiency: proficiency,
                                source: 'ai'
                            });
                        }
                    });
            } catch (aiError) {
                console.warn('AI extraction failed, using basic results:', aiError);
            }
        }

        // If no skills found, use dictionary-based extraction as backup
        if (skills.size === 0) {
            console.log('Using dictionary-based extraction as backup...');
            for (const skill of allSkills) {
                if (text.toLowerCase().includes(skill.toLowerCase())) {
                    skills.set(skill.toLowerCase(), {
                        skill: skill,
                        proficiency: 'intermediate',
                        source: 'dictionary'
                    });
                }
            }
        }

        const result = Array.from(skills.values());
        console.log(`Extracted ${result.length} unique skills:`, result);
        return result;

    } catch (error) {
        console.error('Error in skill extraction:', error);
        // Return basic extraction results as fallback
        return basicSkillExtraction(text);
    }
}

// Helper function to format proficiency
function formatProficiency(proficiency) {
    if (typeof proficiency === 'number') {
        if (proficiency >= 0.8) return 'expert';
        if (proficiency >= 0.6) return 'advanced';
        return 'intermediate';
    }
    return proficiency || 'intermediate';
}

// Helper functions for skill analysis
function estimateYearsFromContext(text, skill) {
    try {
        const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const yearsMatch = text.match(new RegExp(`(\\d+)\\s*years?.*?${escapedSkill}`, 'i'));
        return yearsMatch ? parseInt(yearsMatch[1]) : 1;
    } catch (error) {
        console.error('Error in estimateYearsFromContext:', error);
        return 1;
    }
}

function countMentions(text, skill) {
    const regex = new RegExp(skill, 'gi');
    return (text.match(regex) || []).length;
}

function analyzeUsageContext(text, skill) {
    const context = text.toLowerCase();
    return {
        leadership: /lead|manage|direct/i.test(context),
        architecture: /architect|design|structure/i.test(context),
        development: /develop|implement|build/i.test(context),
        maintenance: /maintain|support|operate/i.test(context)
    };
}

// Initialize models immediately
loadModels().catch(error => {
    console.error('Initial model loading failed:', error);
    console.log('System will fall back to basic analysis if needed');
});

// Add input validation helper
function validateResumeInput(resumeData) {
    if (!resumeData || typeof resumeData !== 'object') {
        throw new Error('Invalid resume data format');
    }

    const resumeText = resumeData.text || resumeData.summary || '';
    if (!resumeText.trim()) {
        throw new Error('Resume text is required');
    }

    // Normalize and validate skills array
    const skills = Array.isArray(resumeData.skills) ? 
        resumeData.skills
            .filter(Boolean)
            .map(skill => typeof skill === 'object' ? skill.name : skill)
            .filter(skill => typeof skill === 'string' && skill.trim()) : [];

    // Normalize and validate education array
    const education = Array.isArray(resumeData.education) ?
        resumeData.education.filter(edu => 
            edu && typeof edu === 'object' && 
            (edu.degree || edu.institution || edu.field)
        ) : [];

    // Normalize and validate experience array
    const experience = Array.isArray(resumeData.experience) ?
        resumeData.experience.filter(exp => 
            exp && typeof exp === 'object' && 
            (exp.title || exp.company || exp.description)
        ) : [];

    return {
        text: resumeText.trim(),
        job_type: (resumeData.job_type || 'Software Developer').trim(),
        skills,
        education,
        experience,
        summary: (resumeData.summary || resumeText).trim()
    };
}

// Add this function to determine overall skill level
function determineSkillLevel(resumeData, skillsAnalysis) {
    try {
        let skillLevelScore = 0;
        let totalFactors = 0;

        // Experience Level Analysis (0-40 points)
        if (Array.isArray(resumeData.experience)) {
            const totalYearsExp = resumeData.experience.reduce((total, exp) => {
                if (exp.duration) {
                    const durationMatch = exp.duration.match(/\d+/);
                    return total + (durationMatch ? parseInt(durationMatch[0]) : 0);
                }
                return total;
            }, 0);

            if (totalYearsExp >= 8) skillLevelScore += 40;
            else if (totalYearsExp >= 5) skillLevelScore += 30;
            else if (totalYearsExp >= 3) skillLevelScore += 20;
            else if (totalYearsExp >= 1) skillLevelScore += 10;
            totalFactors++;
        }

        // Education Level Analysis (0-30 points)
        if (Array.isArray(resumeData.education)) {
            const highestEducation = resumeData.education.reduce((highest, edu) => {
                const degree = (edu.degree || '').toLowerCase();
                if (degree.includes('phd') || degree.includes('doctorate')) return 30;
                if (highest < 25 && (degree.includes('master') || degree.includes('mba'))) return 25;
                if (highest < 20 && (degree.includes('bachelor') || degree.includes('btech'))) return 20;
                if (highest < 15 && degree.includes('associate')) return 15;
                return highest;
            }, 0);
            
            skillLevelScore += highestEducation;
            totalFactors++;
        }

        // Skills Proficiency Analysis (0-30 points)
        if (skillsAnalysis && skillsAnalysis.matched_skills) {
            const matchedSkillsCount = skillsAnalysis.matched_skills.length;
            const totalSkills = matchedSkillsCount + (skillsAnalysis.missing_skills?.length || 0);
            const skillsRatio = matchedSkillsCount / (totalSkills || 1);

            if (skillsRatio >= 0.8) skillLevelScore += 30;
            else if (skillsRatio >= 0.6) skillLevelScore += 20;
            else if (skillsRatio >= 0.4) skillLevelScore += 10;
            totalFactors++;
        }

        // Normalize score and determine level
        const normalizedScore = totalFactors > 0 ? skillLevelScore / totalFactors : 0;
        
        if (normalizedScore >= 80) return 'expert';
        if (normalizedScore >= 60) return 'senior';
        if (normalizedScore >= 40) return 'intermediate';
        return 'beginner';
    } catch (error) {
        console.error('Error determining skill level:', error);
        return 'beginner'; // Default to beginner if error occurs
    }
}

// Fix experience calculation
function calculateExperienceScore(experience) {
    try {
        if (!Array.isArray(experience)) {
            console.error('Experience data is not an array:', experience);
            return 0;
        }

        let totalScore = 0;
        let totalYears = 0;
        let maxRoleScore = 0;
        let skillYears = [];

        // First check for explicit experience entries
        for (const exp of experience) {
            let yearsInRole = 0;
            
            // Calculate years from dates if available
            if (exp.start_date) {
                const startDate = new Date(exp.start_date);
                const endDate = exp.end_date ? new Date(exp.end_date) : new Date();
                yearsInRole = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365);
            }
            
            // Only use years from title/description if no dates available
            if (yearsInRole === 0) {
                const yearsMatch = exp.title?.match(/(\d+)\s*years?/i) || 
                                 exp.description?.match(/(\d+)\s*years?/i);
                if (yearsMatch) {
                    yearsInRole = parseInt(yearsMatch[1]);
                }
            }

            totalYears += yearsInRole;

            // Calculate role score
            let roleScore = 0;
            const title = (exp.title || '').toLowerCase();
            const description = (exp.description || '').toLowerCase();

            // Seniority score (max 60 points)
            if (title.includes('principal') || title.includes('architect')) roleScore += 60;
            else if (title.includes('senior') || title.includes('lead')) roleScore += 55;
            else if (title.includes('manager') || title.includes('head')) roleScore += 50;
            else if (title.includes('staff')) roleScore += 45;
            else if (title.includes('engineer') || title.includes('developer')) roleScore += 35;
            else roleScore += 25;

            // Add years bonus (max 20 points)
            roleScore += Math.min(20, yearsInRole * 4);

            maxRoleScore = Math.max(maxRoleScore, roleScore);
        }

        // Then check for skills with experience years
        const skillsText = Array.isArray(experience) ? experience.join('\n') : experience.toString();
        const skillMatches = skillsText.matchAll(/([a-zA-Z0-9+#.]+(?:\s*[a-zA-Z0-9+#.]+)*)\s*-\s*(master|expert)\s*\((\d+)\s*years?\)/gi);
        
        for (const match of skillMatches) {
            const [_, skill, level, years] = match;
            skillYears.push({
                skill: skill.trim(),
                years: parseInt(years),
                level: level.toLowerCase()
            });
        }

        if (skillYears.length > 0) {
            // Get max years from skills
            totalYears = Math.max(...skillYears.map(s => s.years));
            
            // Calculate score based on skill years and levels
            let skillScore = 0;
            for (const skill of skillYears) {
                // Base points for skill (max 40)
                let points = Math.min(40, skill.years * 8);
                
                // Level bonus
                if (skill.level === 'expert') points += 20;
                else if (skill.level === 'master') points += 15;
                
                skillScore = Math.max(skillScore, points);
            }
            
            maxRoleScore = Math.max(maxRoleScore, skillScore);
        }

        // Calculate final score
        totalScore = maxRoleScore;
        
        // Add total experience bonus (max 20 points)
        if (totalYears >= 10) totalScore += 20;
        else if (totalYears >= 7) totalScore += 15;
        else if (totalYears >= 5) totalScore += 10;
        else if (totalYears >= 3) totalScore += 5;

        console.log('Experience calculation:', {
            totalYears,
            maxRoleScore,
            totalScore,
            experienceCount: experience.length,
            skillYears
        });

        return Math.min(100, totalScore);
    } catch (error) {
        console.error('Error calculating experience score:', error);
        return 0;
    }
}

// Fix job recommendations
async function getJobRecommendations(resumeData, skillsAnalysis) {
    try {
        // Calculate total years and analyze roles
        let totalYears = 0;
        let maxSeniorityScore = 0;
        const experience = resumeData.experience || [];
        
        for (const exp of experience) {
            // Calculate years
            if (exp.start_date) {
                const startDate = new Date(exp.start_date);
                const endDate = exp.end_date ? new Date(exp.end_date) : new Date();
                totalYears += (endDate - startDate) / (1000 * 60 * 60 * 24 * 365);
            }

            // Analyze role seniority
            const title = (exp.title || '').toLowerCase();
            let seniorityScore = 0;
            
            if (title.includes('principal') || title.includes('architect')) seniorityScore = 1.0;
            else if (title.includes('senior') || title.includes('lead')) seniorityScore = 0.9;
            else if (title.includes('manager') || title.includes('head')) seniorityScore = 0.85;
            else if (title.includes('staff')) seniorityScore = 0.8;
            else if (title.includes('engineer') || title.includes('developer')) seniorityScore = 0.6;
            
            maxSeniorityScore = Math.max(maxSeniorityScore, seniorityScore);
        }

        // Determine experience level based on both years and seniority
        let level;
        const yearsScore = totalYears >= 8 ? 1.0 :
                          totalYears >= 5 ? 0.8 :
                          totalYears >= 3 ? 0.6 :
                          totalYears >= 1 ? 0.4 : 0.2;
                          
        const combinedScore = (yearsScore * 0.6) + (maxSeniorityScore * 0.4);

        if (combinedScore >= 0.8) level = 'expert';
        else if (combinedScore >= 0.6) level = 'senior';
        else if (combinedScore >= 0.4) level = 'intermediate';
        else level = 'beginner';

        console.log('Experience analysis:', {
            totalYears,
            maxSeniorityScore,
            yearsScore,
            combinedScore,
            determinedLevel: level
        });

        // Generate job recommendations
        const recommendations = [];
        const jobTitles = {
            expert: ['Principal', 'Lead', 'Senior', 'Architect'],
            senior: ['Senior', 'Lead', 'Staff'],
            intermediate: ['Mid-Level', 'Full Stack', 'Software'],
            beginner: ['Junior', 'Entry Level', 'Associate']
        }[level] || ['Software'];

        // Get skill proficiency data
        const skillProficiencies = resumeData.skills_analysis?.skills_with_proficiency || [];
        const highProficiencySkills = skillProficiencies
            .filter(s => s.proficiency_details?.score >= 70)
            .map(s => s.name);

        for (const title of jobTitles) {
            const jobTitle = `${title} ${resumeData.job_type || 'Software Developer'}`;
            
            // Calculate match percentage considering skill proficiency
            const skillWeight = 0.5;
            const experienceWeight = 0.3;
            const proficiencyWeight = 0.2;

            const matchPercentage = Math.round(
                (skillsAnalysis.match_percentage * skillWeight) +
                (combinedScore * 100 * experienceWeight) +
                (highProficiencySkills.length / Math.max(1, skillsAnalysis.matched_skills.length) * 100 * proficiencyWeight)
            );

            // Get role analysis
            const analysis = await analyzeSentimentAI(
                `${jobTitle} role requirements and responsibilities with ${totalYears.toFixed(1)} years of experience`
            );

            recommendations.push({
                title: jobTitle,
                match_percentage: matchPercentage,
                level: level,
                salary_range: await getAISalaryRange(level, skillsAnalysis.matched_skills),
                required_skills: [
                    ...new Set([
                        ...highProficiencySkills,
                        ...skillsAnalysis.matched_skills.slice(0, 5).map(s => s.name)
                    ])
                ].slice(0, 5),
                missing_skills: skillsAnalysis.missing_skills.slice(0, 3),
                description: analysis.label,
                growth_potential: 'Excellent',
                market_demand: 'High',
                experience_required: `${Math.max(0, Math.floor(totalYears - 2))}-${Math.ceil(totalYears + 2)} years`
            });
        }

        return recommendations
            .sort((a, b) => b.match_percentage - a.match_percentage)
            .slice(0, 3);

    } catch (error) {
        console.error('Error generating job recommendations:', error);
        return getDefaultJobRecommendations();
    }
}

// AI helper functions
async function getAISalaryRange(level, skills) {
    try {
        const analysis = await analyzeSentimentAI(
            `Current market salary range for ${level} position with skills: ${skills.map(s => s.name).join(', ')}`
        );
        
        // Base ranges with actual numbers
        const baseRanges = {
            beginner: '50000-75000',
            intermediate: '75000-100000',
            senior: '100000-140000',
            expert: '140000-200000'
        };

        const range = baseRanges[level.toLowerCase()] || baseRanges.beginner;
        const [min, max] = range.split('-').map(Number);

        // Adjust based on AI analysis and skills
        const multiplier = analysis.score > 0.8 ? 1.2 : 
                         analysis.score > 0.6 ? 1.1 : 1.0;

        const adjustedMin = Math.round(min * multiplier);
        const adjustedMax = Math.round(max * multiplier);

        return `$${adjustedMin.toLocaleString()} - $${adjustedMax.toLocaleString()}`;
    } catch (error) {
        console.error('Error getting AI salary range:', error);
        return '$70,000 - $120,000'; // Fallback range
    }
}

async function generateAIJobTitles(skills, level, experienceComplexity) {
    try {
        const analysis = await analyzeSentimentAI(
            `Suggest job titles for ${level} position with skills: ${skills.join(', ')}`
        );
        
        // Generate titles based on AI analysis and experience
        const titles = [];
        if (analysis.score > 0.7) {
            titles.push(`Senior ${skills[0]} Developer`);
            titles.push(`Lead ${skills[0]} Engineer`);
        } else if (analysis.score > 0.5) {
            titles.push(`${skills[0]} Developer`);
            titles.push(`${skills[0]} Engineer`);
        } else {
            titles.push(`Junior ${skills[0]} Developer`);
            titles.push(`Associate ${skills[0]} Engineer`);
        }
        
        return titles;
    } catch (error) {
        console.error('Error generating AI job titles:', error);
        return [];
    }
}

async function generateAIJobDescription(title, level, skills) {
    try {
        const analysis = await analyzeSentimentAI(
            `Generate job description for ${title} (${level}) with skills: ${skills.join(', ')}`
        );
        
        return `${title} position requiring strong expertise in ${skills.slice(0, 3).join(', ')}. `
            + `This ${level} role offers opportunities for ${analysis.score > 0.7 ? 'leadership and architecture' : 'technical growth and development'}. `
            + `Ideal candidate will have demonstrated experience in ${skills.slice(3, 5).join(' and ')}.`;
    } catch (error) {
        console.error('Error generating AI job description:', error);
        return getDefaultJobDescription(title, level, skills);
    }
}

async function calculateAIGrowthPotential(title, skills) {
    try {
        const analysis = await analyzeSentimentAI(
            `Analyze career growth potential for ${title} with skills: ${skills.join(', ')}`
        );
        
        if (analysis.score > 0.8) return 'Excellent';
        if (analysis.score > 0.6) return 'High';
        if (analysis.score > 0.4) return 'Good';
        return 'Fair';
    } catch (error) {
        console.error('Error calculating AI growth potential:', error);
        return 'Good';
    }
}

async function getAIMarketDemand(title, skills) {
    try {
        const analysis = await analyzeSentimentAI(
            `Analyze current market demand for ${title} with skills: ${skills.join(', ')}`
        );
        
        if (analysis.score > 0.8) return 'Very High';
        if (analysis.score > 0.6) return 'High';
        if (analysis.score > 0.4) return 'Moderate';
        return 'Fair';
    } catch (error) {
        console.error('Error getting AI market demand:', error);
        return 'Moderate';
    }
}

// Add missing getSkillMarketDemand function
async function getSkillMarketDemand(skillName) {
    try {
        const analysis = await analyzeSentimentAI(
            `Analyze current market demand for ${skillName} skill in tech industry`
        );
        
        if (analysis.score > 0.8) return { current: 'Very High', trend: 'Growing' };
        if (analysis.score > 0.6) return { current: 'High', trend: 'Stable' };
        if (analysis.score > 0.4) return { current: 'Moderate', trend: 'Stable' };
        return { current: 'Fair', trend: 'Emerging' };
    } catch (error) {
        console.error(`Error getting market demand for ${skillName}:`, error);
        return { current: 'Moderate', trend: 'Stable' };
    }
}

// Add missing getEnhancedCourseRecommendations function
async function getEnhancedCourseRecommendations(jobType, matchedSkills, missingSkills, skillLevel) {
    try {
        const recommendations = [];
        
        // Recommend courses for missing critical skills first
        for (const skill of missingSkills.slice(0, 3)) {
            recommendations.push({
                title: `${skill.name} for ${jobType}`,
                provider: 'Coursera',
                description: `Master ${skill.name} for ${jobType} roles`,
                level: skillLevel,
                url: `https://www.coursera.org/courses?query=${encodeURIComponent(skill.name)}`,
                skill_type: skill.importance,
                estimated_duration: '6-8 weeks',
                price_range: '$49-99',
                rating: 4.5,
                students_enrolled: '10,000+'
            });
        }
        
        // Recommend advanced courses for matched skills
        for (const skill of matchedSkills.slice(0, 2)) {
            if (skill.proficiency < 90) {
                recommendations.push({
                    title: `Advanced ${skill.name}`,
                    provider: 'Udemy',
                    description: `Advanced techniques and best practices in ${skill.name}`,
                    level: 'Advanced',
                    url: `https://www.udemy.com/courses?q=${encodeURIComponent(skill.name)}`,
                    skill_type: 'enhancement',
                    estimated_duration: '4-6 weeks',
                    price_range: '$79-149',
                    rating: 4.6,
                    students_enrolled: '15,000+'
                });
            }
        }
        
        return recommendations;
    } catch (error) {
        console.error('Error getting course recommendations:', error);
        return DEFAULT_RESPONSE.course_recommendations;
    }
}

// Add missing getEnhancedCertificationRecommendations function
async function getEnhancedCertificationRecommendations(jobType, matchedSkills, missingSkills, skillLevel) {
    try {
        // Get relevant certifications from job requirements
        const jobCerts = jobRequirements[jobType]?.certifications || [];
        
        // Filter and enhance certification recommendations
        const recommendations = jobCerts.map(cert => ({
            title: typeof cert === 'string' ? cert : cert.title,
            provider: typeof cert === 'string' ? 
                cert.split(' ')[0] : cert.provider,
            description: typeof cert === 'string' ? 
                `Professional certification for ${jobType}` : cert.description,
            level: skillLevel === 'expert' ? 'Professional' : 'Associate',
            url: typeof cert === 'string' ? 
                `https://www.google.com/search?q=${encodeURIComponent(cert)}+certification` : cert.url
        }));
        
        return recommendations;
    } catch (error) {
        console.error('Error getting certification recommendations:', error);
        return DEFAULT_RESPONSE.certification_recommendations;
    }
}

// Add missing getMissingSkills function
function getMissingSkills(requiredSkills, userSkills) {
    return requiredSkills.filter(required => 
        !userSkills.some(userSkill => 
            userSkill.toLowerCase().includes(required.toLowerCase()) ||
            required.toLowerCase().includes(userSkill.toLowerCase())
        )
    );
}

// Add missing calculateEducationScore function
function calculateEducationScore(education) {
    try {
        if (!Array.isArray(education)) {
            console.error('Education data is not an array:', education);
            return 0;
        }

        // Define degree weights with variations
        const degreeWeights = {
            'phd': 100,
            'doctorate': 100,
            'doctoral': 100,
            'master': 85,
            'mba': 85,
            'ms': 85,
            'ma': 85,
            'bachelor': 70,
            'bs': 70,
            'ba': 70,
            'btech': 70,
            'associate': 50,
            'diploma': 40,
            'certificate': 30
        };

        // Define field relevance weights
        const fieldWeights = {
            'computer science': 1.0,
            'software engineering': 1.0,
            'information technology': 0.9,
            'data science': 0.9,
            'mathematics': 0.8,
            'statistics': 0.8,
            'engineering': 0.8,
            'business': 0.7,
            'information systems': 0.9
        };

        let maxScore = 0;

        for (const edu of education) {
            let score = 0;
            
            // Parse education data
            const degree = typeof edu === 'string' ? edu : edu.degree || '';
            const field = typeof edu === 'string' ? edu : edu.field || '';
            const institution = typeof edu === 'string' ? edu : edu.institution || '';
            const gpa = typeof edu === 'string' ? 0 : parseFloat(edu.gpa) || 0;
            const graduationYear = typeof edu === 'string' ? 0 : parseInt(edu.graduation_year) || 0;
            const isCompleted = typeof edu === 'string' ? true : (edu.completed !== false);

            // Calculate degree score
            const degreeScore = Object.entries(degreeWeights).reduce((highest, [key, weight]) => {
                if (degree.toLowerCase().includes(key)) {
                    return Math.max(highest, weight);
                }
                return highest;
            }, 30); // Default to 30 if no match

            // Calculate field relevance
            const fieldRelevance = Object.entries(fieldWeights).reduce((highest, [key, weight]) => {
                if (field.toLowerCase().includes(key)) {
                    return Math.max(highest, weight);
                }
                return highest;
            }, 0.7); // Default to 0.7 if no match

            // Base score from degree and field
            score = degreeScore * fieldRelevance;

            // Add bonus for prestigious institutions (simplified check)
            const prestigiousKeywords = ['mit', 'stanford', 'harvard', 'oxford', 'cambridge', 'berkeley'];
            if (prestigiousKeywords.some(keyword => institution.toLowerCase().includes(keyword))) {
                score += 10;
            }

            // Add GPA bonus (max 10 points)
            if (gpa > 0) {
                if (gpa >= 3.7) score += 10;
                else if (gpa >= 3.5) score += 8;
                else if (gpa >= 3.0) score += 5;
            }

            // Add recency bonus (max 5 points)
            const currentYear = new Date().getFullYear();
            if (graduationYear > 0) {
                const yearsAgo = currentYear - graduationYear;
                if (yearsAgo <= 2) score += 5;
                else if (yearsAgo <= 5) score += 3;
                else if (yearsAgo <= 10) score += 1;
            }

            // Penalty for incomplete education
            if (!isCompleted) {
                score *= 0.8;
            }

            // Update max score
            maxScore = Math.max(maxScore, score);
        }

        // Normalize score to 0-100 range
        return Math.min(100, Math.round(maxScore));
    } catch (error) {
        console.error('Error calculating education score:', error);
        return 0;
    }
}

// Add missing calculateSkillMatch function
function calculateSkillMatch(requiredSkills, userSkills) {
    try {
        if (!Array.isArray(requiredSkills) || !Array.isArray(userSkills)) {
            console.error('Invalid input to calculateSkillMatch:', { requiredSkills, userSkills });
            return 0;
        }

        // Convert all skills to lowercase for case-insensitive matching
        const normalizedRequired = requiredSkills.map(s => s.toLowerCase());
        const normalizedUser = userSkills.map(s => s.toLowerCase());

        // Count exact matches
        const exactMatches = normalizedRequired.filter(req => 
            normalizedUser.some(user => user === req)
        );

        // Count partial matches (one skill contains the other)
        const partialMatches = normalizedRequired.filter(req => 
            normalizedUser.some(user => 
                user.includes(req) || req.includes(user)
            )
        );

        // Calculate match percentage
        const totalRequired = normalizedRequired.length;
        if (totalRequired === 0) return 0;

        // Weight exact matches more heavily than partial matches
        const exactMatchScore = (exactMatches.length / totalRequired) * 0.7;
        const partialMatchScore = (partialMatches.length / totalRequired) * 0.3;

        // Calculate final score and round to nearest integer
        const matchPercentage = Math.round((exactMatchScore + partialMatchScore) * 100);

        console.log('Skill match calculation:', {
            totalRequired,
            exactMatches: exactMatches.length,
            partialMatches: partialMatches.length,
            matchPercentage
        });

        return matchPercentage;
    } catch (error) {
        console.error('Error calculating skill match:', error);
        return 0;
    }
}