const generateCourseRecommendations = (jobType, skills, missingSkills) => {
  // Group courses by skill level
  const coursesByLevel = {
    Beginner: [
      {
        title: 'Programming Fundamentals',
        description: 'Learn the basics of programming including syntax, data structures, and algorithms.',
        provider: 'Coursera',
        url: 'https://coursera.org/programming-fundamentals'
      },
      {
        title: 'Web Development Basics',
        description: 'Introduction to HTML, CSS, and JavaScript for beginners.',
        provider: 'Udemy',
        url: 'https://udemy.com/web-dev-basics'
      }
    ],
    Intermediate: [
      {
        title: 'Advanced Programming Concepts',
        description: 'Master advanced programming concepts including design patterns and software architecture.',
        provider: 'Coursera',
        url: 'https://coursera.org/advanced-programming'
      },
      {
        title: 'Cloud Computing Essentials',
        description: 'Learn cloud architecture and deployment with hands-on projects.',
        provider: 'Udemy',
        url: 'https://udemy.com/cloud-computing'
      }
    ],
    Advanced: [
      {
        title: 'System Architecture & Design',
        description: 'Advanced system design patterns and architectural principles.',
        provider: 'PluralSight',
        url: 'https://pluralsight.com/system-architecture'
      },
      {
        title: 'Enterprise Development',
        description: 'Build scalable enterprise applications with modern technologies.',
        provider: 'edX',
        url: 'https://edx.org/enterprise-dev'
      }
    ]
  };

  const courseRecommendations = [];
  const seenProviders = new Set();

  // Helper function to add courses based on skill level
  const addCoursesByLevel = (level, count) => {
    const courses = coursesByLevel[level] || [];
    courses.forEach(course => {
      if (courseRecommendations.length < count && !seenProviders.has(course.provider)) {
        courseRecommendations.push(course);
        seenProviders.add(course.provider);
      }
    });
  };

  // Analyze skill levels
  const skillLevels = skills.reduce((acc, skill) => {
    acc[skill.level] = (acc[skill.level] || 0) + 1;
    return acc;
  }, {});

  // Determine predominant skill level
  let predominantLevel = 'Beginner';
  let maxCount = 0;
  Object.entries(skillLevels).forEach(([level, count]) => {
    if (count > maxCount) {
      maxCount = count;
      predominantLevel = level;
    }
  });

  // Add courses based on skill level distribution
  if (predominantLevel === 'Beginner') {
    addCoursesByLevel('Beginner', 3);
    addCoursesByLevel('Intermediate', 2);
  } else if (predominantLevel === 'Intermediate') {
    addCoursesByLevel('Intermediate', 3);
    addCoursesByLevel('Advanced', 2);
  } else {
    addCoursesByLevel('Advanced', 3);
    addCoursesByLevel('Intermediate', 2);
  }

  // Add specific courses for missing skills
  if (missingSkills && missingSkills.length > 0) {
    missingSkills.forEach(skill => {
      if (courseRecommendations.length >= 5) return;

      if (skill.toLowerCase().includes('python')) {
        courseRecommendations.push({
          title: 'Python Programming Masterclass',
          description: 'Complete Python programming course covering basics to advanced topics.',
          provider: 'Udacity',
          url: 'https://udacity.com/python-masterclass',
          level: predominantLevel
        });
      }
      if (skill.toLowerCase().includes('java')) {
        courseRecommendations.push({
          title: 'Java Enterprise Development',
          description: 'Learn enterprise Java development, including Spring Framework, Hibernate, and microservices architecture.',
          provider: 'PluralSight',
          url: 'https://pluralsight.com/java-enterprise',
          level: predominantLevel
        });
      }
      if (skill.toLowerCase().includes('data')) {
        courseRecommendations.push({
          title: 'Data Science Fundamentals',
          description: 'Comprehensive introduction to data science, covering statistics, machine learning, and data visualization.',
          provider: 'DataCamp',
          url: 'https://datacamp.com/data-science',
          level: predominantLevel
        });
      }
    });
  }

  return courseRecommendations.slice(0, 5);
};

const generateCertificationRecommendations = (jobType, skills) => {
  // Track seen certifications to avoid duplicates
  const seenCerts = new Set();
  const certifications = [];
  const providers = new Set();

  const addCertification = (cert) => {
    const certKey = `${cert.title}_${cert.provider}`.toLowerCase();
    if (!seenCerts.has(certKey)) {
      seenCerts.add(certKey);
      providers.add(cert.provider);
      certifications.push(cert);
    }
  };

  // Analyze skill levels
  const skillLevels = skills.reduce((acc, skill) => {
    acc[skill.level] = (acc[skill.level] || 0) + 1;
    return acc;
  }, {});

  // Determine appropriate certification levels
  const hasAdvancedSkills = skillLevels['Advanced'] > 0 || skillLevels['Expert'] > 0 || skillLevels['Master'] > 0;
  const hasIntermediateSkills = skillLevels['Intermediate'] > 0;

  // Certification recommendations based on skill levels
  if (hasAdvancedSkills) {
    addCertification({
      title: 'AWS Certified Solutions Architect Professional',
      description: 'Advanced certification for designing distributed systems on AWS.',
      provider: 'Amazon',
      level: 'Professional'
    });
  } else if (hasIntermediateSkills) {
    addCertification({
      title: 'AWS Certified Developer Associate',
      description: 'Certification for developing and maintaining AWS-based applications.',
      provider: 'Amazon',
      level: 'Associate'
    });
  } else {
    addCertification({
      title: 'AWS Cloud Practitioner',
      description: 'Foundational certification for understanding cloud concepts.',
      provider: 'Amazon',
      level: 'Foundational'
    });
  }

  // Add role-specific certifications based on job type and skill levels
  if (jobType.toLowerCase().includes('devops')) {
    const cert = hasAdvancedSkills ? {
      title: 'Certified Kubernetes Administrator',
      description: 'Advanced certification for Kubernetes administration.',
      provider: 'CNCF',
      level: 'Professional'
    } : {
      title: 'Docker Certified Associate',
      description: 'Foundational certification for container technologies.',
      provider: 'Docker',
      level: 'Associate'
    };
    addCertification(cert);
  }

  // Add more certifications based on skill levels
  if (certifications.length < 3) {
    const additionalCerts = hasAdvancedSkills ? [
      {
        title: 'Google Cloud Professional Architect',
        description: 'Advanced certification for GCP architecture.',
        provider: 'Google',
        level: 'Professional'
      },
      {
        title: 'Azure Solutions Architect Expert',
        description: 'Expert level certification for Azure architecture.',
        provider: 'Microsoft',
        level: 'Expert'
      }
    ] : [
      {
        title: 'Google Cloud Associate Engineer',
        description: 'Associate level certification for GCP.',
        provider: 'Google',
        level: 'Associate'
      },
      {
        title: 'Azure Developer Associate',
        description: 'Associate level certification for Azure development.',
        provider: 'Microsoft',
        level: 'Associate'
      }
    ];

    additionalCerts.forEach(cert => {
      if (certifications.length < 3 && !providers.has(cert.provider)) {
        addCertification(cert);
      }
    });
  }

  return certifications;
};

const analyzeResume = async (resumeData) => {
  try {
    console.log('Starting resume analysis with data:', {
      textLength: resumeData.text?.length,
      jobType: resumeData.job_type,
      skillsCount: resumeData.skills?.length,
      educationCount: resumeData.education?.length
    });

    // Validate and sanitize input
    if (!resumeData || typeof resumeData !== 'object') {
      console.error('Invalid resume data provided');
      return DEFAULT_RESPONSE;
    }

    const { 
      text = '', 
      job_type = 'Software Developer', 
      skills = [], 
      education = [],
      experience = [],
      summary = '' 
    } = resumeData;
    
    // Ensure we have text content
    const textContent = text || summary || '';
    if (textContent.trim() === '') {
      console.error('No resume text provided');
      return DEFAULT_RESPONSE;
    }
    
    // Combine all text content for analysis
    const combinedText = `${summary}\n\n${textContent}\n\n${
      Array.isArray(education) ? education.map(edu => 
        typeof edu === 'string' ? edu : `${edu.degree} from ${edu.institution}`
      ).join('\n') : ''
    }\n\n${
      Array.isArray(experience) ? experience.map(exp => 
        `${exp.title} at ${exp.company}: ${exp.description}`
      ).join('\n') : ''
    }`;
    
    // Extract and process skills
    const extractedSkills = Array.isArray(skills) ? 
      skills.map(skill => typeof skill === 'object' ? skill.name : skill) : [];
    
    // Get job requirements and calculate scores
    const requirements = jobRequirements[job_type] || getClosestJobMatch(job_type);
    if (!requirements) {
      console.error('No job requirements found for job type:', job_type);
      return DEFAULT_RESPONSE;
    }

    const skillMatchScores = calculateSkillMatchScores(extractedSkills, requirements);
    const textQuality = analyzeTextQuality(combinedText);
    
    // Calculate education score
    const educationMatches = requirements.education.filter(req =>
      Array.isArray(education) && education.some(edu => {
        const eduStr = typeof edu === 'string' ? edu : 
          `${edu.degree || ''} ${edu.institution || ''}`;
        return eduStr.toLowerCase().includes(req.toLowerCase());
      })
    );
    const educationScore = (educationMatches.length / requirements.education.length) * 100;

    // Calculate experience score
    const experienceScore = Array.isArray(experience) ? 
      Math.min(100, experience.length * 20) : 0;

    // Calculate overall score with weighted components
    const weights = {
      skills: 0.35,
      textQuality: 0.20,
      education: 0.25,
      experience: 0.20
    };

    const overallScore = Math.round(
      (skillMatchScores.total * 100 * weights.skills) +
      (textQuality.readability_score * weights.textQuality) +
      (educationScore * weights.education) +
      (experienceScore * weights.experience)
    );

    // Generate job recommendations
    const jobRecs = await getJobRecommendations(job_type, extractedSkills, skillMatchScores.total);
    
    // Create response
    const response = {
      overall_score: Math.min(100, Math.max(0, overallScore)),
      text_quality: {
        readability_score: Math.round(textQuality.readability_score),
        sentence_count: textQuality.sentence_count,
        word_count: textQuality.word_count,
        avg_word_length: textQuality.avg_word_length
      },
      skills_analysis: {
        matched_skills: skillMatchScores.matched,
        missing_skills: skillMatchScores.missing,
        skill_scores: {
          total: Math.round(skillMatchScores.total * 100),
          confidence: Math.round(skillMatchScores.confidence * 100)
        }
      },
      education_analysis: {
        score: Math.round(educationScore),
        matches: educationMatches,
        recommendations: requirements.education.filter(req => 
          !educationMatches.includes(req)
        )
      },
      experience_score: Math.round(experienceScore),
      job_recommendations: jobRecs.length > 0 ? jobRecs : [{
        job_title: job_type,
        match_percentage: Math.round(skillMatchScores.total * 100),
        salary_range: "Based on experience",
        description: "Position matching your profile",
        missing_skills: skillMatchScores.missing.map(s => s.skill)
      }],
      course_recommendations: getCourseRecommendations(job_type, extractedSkills),
      certifications: requirements.certifications || []
    };

    console.log('Analysis complete with scores:', {
      overall: response.overall_score,
      textQuality: response.text_quality.readability_score,
      skillsTotal: response.skills_analysis.skill_scores.total,
      education: response.education_analysis.score,
      experience: response.experience_score
    });

    return response;
  } catch (error) {
    console.error("Error in analyzeResume:", error);
    return DEFAULT_RESPONSE;
  }
};

const natural = require('natural');
const { TfIdf } = natural;

// Function to analyze text quality
function analyze_text_quality(text) {
    try {
        if (!text) {
            return {
                readability_score: 0,
                readability_level: 'Poor',
                clarity_level: 'Poor',
                suggestions: ['No text provided for analysis']
            };
        }

        // Split text into sentences and words
        const sentences = text.split(/[.!?]+/).filter(Boolean);
        const words = text.split(/\s+/).filter(Boolean);
        
        // Calculate basic metrics
        const avgWordsPerSentence = words.length / sentences.length;
        const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
        
        // Calculate readability score (Flesch Reading Ease adapted)
        const readabilityScore = Math.max(0, Math.min(100, 206.835 - (0.8 * avgWordsPerSentence) - (70 * avgWordLength / 5)));
        
        // Determine readability level
        let readabilityLevel;
        if (readabilityScore >= 80) readabilityLevel = 'Excellent';
        else if (readabilityScore >= 60) readabilityLevel = 'Good';
        else if (readabilityScore >= 40) readabilityLevel = 'Fair';
        else readabilityLevel = 'Poor';

        // Analyze clarity
        const clarityIssues = [];
        if (avgWordsPerSentence > 25) clarityIssues.push('Sentences are too long');
        if (avgWordLength > 6) clarityIssues.push('Words are too complex');
        if (sentences.length < 3) clarityIssues.push('Content is too brief');

        // Determine clarity level
        let clarityLevel;
        if (clarityIssues.length <= 1) clarityLevel = 'Excellent';
        else if (clarityIssues.length === 2) clarityLevel = 'Good';
        else clarityLevel = 'Fair';

        return {
            readability_score: Math.round(readabilityScore),
            readability_level: readabilityLevel,
            clarity_level: clarityLevel,
            suggestions: clarityIssues.length > 0 ? clarityIssues : ['Text is well-structured']
        };
    } catch (error) {
        console.error('Error in text quality analysis:', error);
        return {
            readability_score: 0,
            readability_level: 'Error',
            clarity_level: 'Error',
            suggestions: ['Error analyzing text quality']
        };
    }
}

// Function to analyze skills match
function analyze_skills(skills, job_type) {
    try {
        if (!Array.isArray(skills) || skills.length === 0) {
            return {
                matched_skills: [],
                missing_skills: [],
                skills_match_score: 0
            };
        }

        // Define required skills based on job type (simplified example)
        const jobSkillsMap = {
            'software developer': [
                { name: 'JavaScript', level: 'Intermediate', years: 2 },
                { name: 'Python', level: 'Intermediate', years: 2 },
                { name: 'Java', level: 'Intermediate', years: 2 },
                { name: 'React', level: 'Intermediate', years: 2 },
                { name: 'Node.js', level: 'Intermediate', years: 2 },
                { name: 'SQL', level: 'Intermediate', years: 2 },
                { name: 'Git', level: 'Intermediate', years: 1 },
                { name: 'APIs', level: 'Intermediate', years: 2 },
                { name: 'Data Structures', level: 'Intermediate', years: 2 },
                { name: 'Algorithms', level: 'Intermediate', years: 2 },
                { name: 'AWS', level: 'Intermediate', years: 1 },
                { name: 'Docker', level: 'Intermediate', years: 1 }
            ],
            'data scientist': [
                { name: 'Python', level: 'Advanced', years: 3 },
                { name: 'R', level: 'Intermediate', years: 2 },
                { name: 'SQL', level: 'Advanced', years: 3 },
                { name: 'Machine Learning', level: 'Advanced', years: 3 },
                { name: 'Statistics', level: 'Advanced', years: 3 },
                { name: 'Data Visualization', level: 'Intermediate', years: 2 },
                { name: 'Pandas', level: 'Advanced', years: 2 },
                { name: 'NumPy', level: 'Advanced', years: 2 },
                { name: 'Scikit-learn', level: 'Advanced', years: 2 }
            ],
            'web developer': [
                { name: 'HTML', level: 'Advanced', years: 3 },
                { name: 'CSS', level: 'Advanced', years: 3 },
                { name: 'JavaScript', level: 'Advanced', years: 3 },
                { name: 'React', level: 'Intermediate', years: 2 },
                { name: 'Node.js', level: 'Intermediate', years: 2 },
                { name: 'REST APIs', level: 'Intermediate', years: 2 },
                { name: 'Git', level: 'Intermediate', years: 2 },
                { name: 'Responsive Design', level: 'Intermediate', years: 2 },
                { name: 'Web Security', level: 'Intermediate', years: 2 }
            ]
        };

        // Get required skills for the job type (case-insensitive)
        const jobTypeKey = Object.keys(jobSkillsMap)
            .find(key => key.toLowerCase() === job_type.toLowerCase()) || 'software developer';
        const requiredSkills = jobSkillsMap[jobTypeKey];

        // Process user skills to handle both string and object formats
        const userSkills = skills.map(skill => {
            if (typeof skill === 'string') {
                return {
                    name: skill.toLowerCase(),
                    level: 'Intermediate',
                    years: 1
                };
            }
            return {
                name: skill.name.toLowerCase(),
                level: skill.level || 'Intermediate',
                years: skill.years || 1
            };
        });

        // Find matched and missing skills
        const matched_skills = [];
        const missing_skills = [];

        requiredSkills.forEach(requiredSkill => {
            const found = userSkills.find(userSkill => 
                userSkill.name.includes(requiredSkill.name.toLowerCase()) ||
                requiredSkill.name.toLowerCase().includes(userSkill.name)
            );

            if (found) {
                matched_skills.push({
                    name: requiredSkill.name,
                    level: found.level,
                    years: found.years
                });
            } else {
                missing_skills.push({
                    name: requiredSkill.name,
                    required_level: requiredSkill.level,
                    market_demand: 'High'
                });
            }
        });

        // Calculate match percentage
        const match_percentage = (matched_skills.length / requiredSkills.length) * 100;

        return {
            matched_skills,
            missing_skills,
            skills_match_score: Math.round(match_percentage)
        };
    } catch (error) {
        console.error('Error in skills analysis:', error);
        return {
            matched_skills: [],
            missing_skills: [],
            skills_match_score: 0
        };
    }
}

// Function to calculate education score
function calculate_education_score(education) {
    try {
        if (!Array.isArray(education) || education.length === 0) {
            return 0;
        }

        const degreeWeights = {
            'phd': 100,
            'doctorate': 100,
            'master': 85,
            'masters': 85,
            'bachelor': 70,
            'bachelors': 70,
            'associate': 50,
            'associates': 50,
            'certificate': 30,
            'certification': 30,
            'diploma': 40
        };

        let maxScore = 0;
        education.forEach(edu => {
            let score = 50; // Base score

            // Check degree level
            const degree = edu.degree?.toLowerCase() || '';
            for (const [key, weight] of Object.entries(degreeWeights)) {
                if (degree.includes(key)) {
                    score = weight;
                    break;
                }
            }

            // Add bonus for GPA if available
            if (edu.gpa) {
                const gpa = parseFloat(edu.gpa);
                if (gpa >= 3.5) score += 15;
                else if (gpa >= 3.0) score += 10;
                else if (gpa >= 2.5) score += 5;
            }

            // Update max score
            maxScore = Math.max(maxScore, score);
        });

        return Math.min(100, maxScore);
    } catch (error) {
        console.error('Error in education score calculation:', error);
        return 0;
    }
}

// Function to calculate experience score
function calculate_experience_score(experience) {
    try {
        if (!Array.isArray(experience) || experience.length === 0) {
            return 0;
        }

        let totalScore = 0;
        const roleWeights = {
            'senior': 20,
            'lead': 20,
            'manager': 20,
            'architect': 20,
            'principal': 25,
            'director': 25,
            'head': 25,
            'chief': 30,
            'vp': 30,
            'president': 30,
            'founder': 30
        };

        experience.forEach(exp => {
            let score = 10; // Base score per experience entry

            // Add score based on role seniority
            const title = exp.title?.toLowerCase() || '';
            for (const [key, weight] of Object.entries(roleWeights)) {
                if (title.includes(key)) {
                    score += weight;
                    break;
                }
            }

            // Add score based on duration
            const duration = exp.duration?.toLowerCase() || '';
            const years = parseInt(duration) || 0;
            score += Math.min(years * 5, 30); // Up to 30 points for duration

            totalScore += score;
        });

        // Normalize score to 0-100 range
        const maxPossibleScore = 100; // Maximum possible score
        const normalizedScore = Math.min(100, (totalScore / maxPossibleScore) * 100);

        return Math.round(normalizedScore);
    } catch (error) {
        console.error('Error in experience score calculation:', error);
        return 0;
    }
}

module.exports = {
  analyzeResume,
  analyze_text_quality,
  analyze_skills,
  calculate_education_score,
  calculate_experience_score
}; 