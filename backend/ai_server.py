from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import numpy as np
from transformers import pipeline
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import logging
import requests
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize ML models with error handling
try:
    # Initialize sentence transformer for text similarity
    sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
    logger.info("Successfully loaded sentence transformer model")
except Exception as e:
    logger.error(f"Error loading sentence transformer model: {str(e)}")
    sentence_model = None

try:
    # Initialize sentiment analysis pipeline
    sentiment_analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
    logger.info("Successfully loaded sentiment analysis model")
except Exception as e:
    logger.error(f"Error loading sentiment analysis model: {str(e)}")
    sentiment_analyzer = None

def calculate_education_score(education):
    """Calculate education score based on degree level and GPA"""
    try:
        if not education:
            return 0
        
        # Define degree weights
        degree_weights = {
            'phd': 100,
            'masters': 90,
            'bachelors': 80,
            'associates': 70,
            'certificate': 60
        }
        
        # Calculate score based on highest degree
        max_score = 0
        for edu in education:
            degree = edu.get('degree', '').lower()
            weight = degree_weights.get(degree, 50)
            max_score = max(max_score, weight)
        
        return max_score
        
    except Exception as e:
        logger.error(f"Error in calculate_education_score: {str(e)}")
        return 0

def calculate_experience_score(experience):
    """Calculate experience score based on years and role seniority"""
    try:
        if not experience:
            return 0
        
        # Define role weights
        role_weights = {
            'senior': 100,
            'lead': 90,
            'mid-level': 80,
            'junior': 70,
            'entry': 60
        }
        
        # Calculate score based on experience
        total_score = 0
        for exp in experience:
            role = exp.get('role', '').lower()
            duration = float(exp.get('duration', 0))
            weight = role_weights.get(role, 50)
            total_score += weight * min(duration, 5) / 5  # Cap at 5 years per role
        
        return min(100, total_score / len(experience))
        
    except Exception as e:
        logger.error(f"Error in calculate_experience_score: {str(e)}")
        return 0

async def get_ai_recommendations(job_type, skills, education, experience, location=None):
    """Get AI-generated recommendations using HuggingFace API"""
    try:
        # Determine user's skill level based on experience and skills
        user_level = determine_user_level(skills, experience)
        print(f"Determined user level: {user_level}")

        # Construct location context for job search
        location_context = ""
        if location:
            location_context = f" in {location}"
        
        # Construct the prompt for the AI
        prompt = f"""Based on the following resume information, provide personalized career recommendations:

Job Type: {job_type}
Location: {location if location else 'Not specified'}
Skill Level: {user_level}
Skills: {', '.join([skill.get('name', '') for skill in skills])}
Education: {', '.join([edu.get('degree', '') for edu in education])}
Experience: {len(experience)} positions

Please provide:
1. Job recommendations{location_context} that match the user's skill level ({user_level})
2. Course recommendations appropriate for {user_level} level
3. Certification recommendations suitable for {user_level} level

For each recommendation, include:
- Detailed description
- Required skill level
- How it matches the user's profile
- Direct links to apply/enroll
- Match percentage
- Skills covered/required
- Prerequisites (if any)
- Career impact
- Market demand

Format the response as a JSON object with the following structure:
{{
    "job_recommendations": [
        {{
            "title": "Job Title",
            "company": "Company Name",
            "location": "Job Location",
            "description": "Detailed job description",
            "required_skills": ["skill1", "skill2"],
            "matched_skills": ["skill1", "skill2"],
            "missing_skills": ["skill3"],
            "match_score": 85,
            "salary_range": "Salary range",
            "job_link": "Direct link to apply",
            "experience_level": "Required experience level",
            "match_details": "How the user's profile matches this job"
        }}
    ],
    "course_recommendations": [
        {{
            "name": "Course Name",
            "provider": "Course Provider",
            "description": "Course description",
            "skills_covered": ["skill1", "skill2"],
            "prerequisites": ["prereq1"],
            "duration": "Course duration",
            "level": "Course level",
            "link": "Course link",
            "match_score": 90
        }}
    ],
    "certification_recommendations": [
        {{
            "name": "Certification Name",
            "provider": "Certification Provider",
            "description": "Certification description",
            "skills_covered": ["skill1", "skill2"],
            "prerequisites": ["prereq1"],
            "duration": "Time to complete",
            "level": "Certification level",
            "link": "Certification link",
            "match_score": 95
        }}
    ]
}}"""

        # Get recommendations from HuggingFace API
        api_url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
        headers = {"Authorization": f"Bearer {os.getenv('HUGGINGFACE_API_KEY')}"}
        
        response = requests.post(api_url, headers=headers, json={"inputs": prompt})
        
        if response.status_code != 200:
            logger.error(f"Error from HuggingFace API: {response.text}")
            return get_fallback_recommendations(job_type, skills)
        
        try:
            recommendations = json.loads(response.text[0]['generated_text'])
            logger.info("Successfully parsed AI recommendations")
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            logger.error(f"Error parsing AI response: {str(e)}")
            return get_fallback_recommendations(job_type, skills)
        
        # Validate and clean recommendations
        recommendations = validate_unique_recommendations(recommendations)
        
        # Log analysis for debugging
        log_recommendation_analysis(recommendations, education, experience, skills)
        
        return recommendations
        
    except Exception as e:
        logger.error(f"Error in get_ai_recommendations: {str(e)}")
        return get_fallback_recommendations(job_type, skills)

def determine_user_level(skills, experience):
    """Determine user's skill level based on experience and skills"""
    try:
        # Count total years of experience
        total_years = sum(float(exp.get('duration', 0)) for exp in experience)
        
        # Count number of skills
        skill_count = len(skills)
        
        # Determine level based on experience and skills
        if total_years >= 5 and skill_count >= 10:
            return "Senior"
        elif total_years >= 3 and skill_count >= 7:
            return "Mid-level"
        elif total_years >= 1 and skill_count >= 5:
            return "Junior"
        else:
            return "Entry-level"
            
    except Exception as e:
        logger.error(f"Error in determine_user_level: {str(e)}")
        return "Entry-level"

def log_recommendation_analysis(recommendations, education, experience, skills):
    """Log analysis results for debugging"""
    try:
        logger.info("=== Recommendation Analysis ===")
        logger.info(f"Education: {len(education)} entries")
        logger.info(f"Experience: {len(experience)} entries")
        logger.info(f"Skills: {len(skills)} entries")
        
        if 'job_recommendations' in recommendations:
            logger.info(f"Job Recommendations: {len(recommendations['job_recommendations'])}")
            for job in recommendations['job_recommendations']:
                logger.info(f"- {job.get('title')} (Match: {job.get('match_score')}%)")
        
        if 'course_recommendations' in recommendations:
            logger.info(f"Course Recommendations: {len(recommendations['course_recommendations'])}")
            for course in recommendations['course_recommendations']:
                logger.info(f"- {course.get('name')} (Match: {course.get('match_score')}%)")
        
        if 'certification_recommendations' in recommendations:
            logger.info(f"Certification Recommendations: {len(recommendations['certification_recommendations'])}")
            for cert in recommendations['certification_recommendations']:
                logger.info(f"- {cert.get('name')} (Match: {cert.get('match_score')}%)")
                
    except Exception as e:
        logger.error(f"Error in log_recommendation_analysis: {str(e)}")

def validate_unique_recommendations(recommendations):
    """Ensure recommendations are unique and properly formatted"""
    try:
        # Remove duplicates based on title/name
        if 'job_recommendations' in recommendations:
            seen = set()
            recommendations['job_recommendations'] = [
                job for job in recommendations['job_recommendations']
                if not (job.get('title') in seen or seen.add(job.get('title')))
            ]
        
        if 'course_recommendations' in recommendations:
            seen = set()
            recommendations['course_recommendations'] = [
                course for course in recommendations['course_recommendations']
                if not (course.get('name') in seen or seen.add(course.get('name')))
            ]
        
        if 'certification_recommendations' in recommendations:
            seen = set()
            recommendations['certification_recommendations'] = [
                cert for cert in recommendations['certification_recommendations']
                if not (cert.get('name') in seen or seen.add(cert.get('name')))
            ]
        
        return recommendations
        
    except Exception as e:
        logger.error(f"Error in validate_unique_recommendations: {str(e)}")
        return recommendations

def analyze_text_quality(text):
    """Analyze the quality of resume text"""
    try:
        if not text:
            return {
                'score': 0,
                'readability': 'Poor',
                'clarity': 'Poor',
                'suggestions': ['No text provided for analysis']
            }
        
        # Basic text analysis
        sentences = text.split('.')
        words = text.split()
        avg_sentence_length = len(words) / len(sentences) if sentences else 0
        
        # Calculate readability score (simple implementation)
        readability_score = min(100, max(0, 100 - (avg_sentence_length * 2)))
        
        # Determine readability level
        if readability_score >= 80:
            readability = 'Excellent'
        elif readability_score >= 60:
            readability = 'Good'
        elif readability_score >= 40:
            readability = 'Fair'
        else:
            readability = 'Poor'
        
        # Generate suggestions
        suggestions = []
        if avg_sentence_length > 20:
            suggestions.append('Consider breaking down long sentences')
        if len(words) < 100:
            suggestions.append('Add more detail to your experience')
        
        return {
            'score': readability_score,
            'readability': readability,
            'clarity': readability,
            'suggestions': suggestions
        }
        
    except Exception as e:
        logger.error(f"Error in analyze_text_quality: {str(e)}")
        return {
            'score': 0,
            'readability': 'Error',
            'clarity': 'Error',
            'suggestions': ['Error analyzing text quality']
        }

def analyze_skills_match(user_skills, required_skills):
    """Analyze how well user skills match required skills"""
    try:
        if not user_skills or not required_skills:
            return {
                'match_score': 0,
                'matched_skills': [],
                'missing_skills': []
            }
        
        # Convert skills to sets for comparison
        user_skill_set = set(skill.lower() for skill in user_skills)
        required_skill_set = set(skill.lower() for skill in required_skills)
        
        # Find matches and missing skills
        matched_skills = list(user_skill_set.intersection(required_skill_set))
        missing_skills = list(required_skill_set - user_skill_set)
        
        # Calculate match score
        match_score = (len(matched_skills) / len(required_skill_set)) * 100 if required_skill_set else 0
        
        return {
            'match_score': match_score,
            'matched_skills': matched_skills,
            'missing_skills': missing_skills
        }
        
    except Exception as e:
        logger.error(f"Error in analyze_skills_match: {str(e)}")
        return {
            'match_score': 0,
            'matched_skills': [],
            'missing_skills': []
        }

def analyze_skills(skills, job_type):
    """Analyze skills against job type requirements"""
    try:
        # Define common skills for different job types with expanded sets
        job_skills = {
            'software_development': [
                'python', 'javascript', 'java', 'c++', 'c#', 'ruby', 'go',
                'sql', 'nosql', 'git', 'docker', 'kubernetes',
                'rest api', 'graphql', 'microservices', 'ci/cd',
                'agile', 'scrum', 'testing', 'debugging',
                'data structures', 'algorithms', 'system design'
            ],
            'web_development': [
                'html', 'css', 'javascript', 'typescript', 
                'react', 'angular', 'vue.js', 'node.js', 'express',
                'mongodb', 'postgresql', 'mysql', 'redis',
                'rest api', 'graphql', 'webpack', 'babel',
                'sass', 'less', 'bootstrap', 'tailwind',
                'docker', 'nginx', 'aws', 'firebase',
                'testing', 'responsive design', 'web security'
            ],
            'data_science': [
                'python', 'r', 'sql', 'machine learning', 'deep learning',
                'statistics', 'pandas', 'numpy', 'scipy', 'scikit-learn',
                'tensorflow', 'pytorch', 'keras', 'jupyter',
                'data visualization', 'tableau', 'power bi',
                'big data', 'hadoop', 'spark', 'data mining',
                'nlp', 'computer vision', 'time series'
            ],
            'cybersecurity': [
                'security', 'networking', 'linux', 'python', 'encryption',
                'penetration testing', 'vulnerability assessment',
                'firewall', 'ids/ips', 'siem', 'incident response',
                'malware analysis', 'forensics', 'threat hunting',
                'security tools', 'compliance', 'risk management',
                'cloud security', 'application security'
            ],
            'cloud_computing': [
                'aws', 'azure', 'gcp', 'docker', 'kubernetes',
                'terraform', 'ansible', 'jenkins', 'ci/cd',
                'microservices', 'serverless', 'iaas', 'paas',
                'cloud security', 'monitoring', 'logging',
                'load balancing', 'auto scaling', 'high availability',
                'devops', 'sre', 'cloud architecture'
            ],
            'devops': [
                'linux', 'docker', 'kubernetes', 'jenkins', 'gitlab',
                'aws', 'azure', 'terraform', 'ansible', 'puppet',
                'ci/cd', 'shell scripting', 'python', 'git',
                'monitoring', 'logging', 'prometheus', 'grafana',
                'nginx', 'apache', 'networking', 'security'
            ],
            'mobile_development': [
                'android', 'kotlin', 'java', 'ios', 'swift',
                'react native', 'flutter', 'mobile ui/ux',
                'rest api', 'sqlite', 'firebase', 'app security',
                'push notifications', 'mobile testing',
                'app performance', 'mobile analytics'
            ],
            'full_stack': [
                'html', 'css', 'javascript', 'typescript',
                'react', 'angular', 'vue.js', 'node.js',
                'python', 'java', 'sql', 'nosql',
                'rest api', 'docker', 'git', 'aws',
                'system design', 'testing', 'security'
            ]
        }
        
        # Convert user skills to lowercase for comparison
        user_skills_lower = [skill.get('name', '').lower() for skill in skills]
        
        # Get required skills for job type
        required_skills = job_skills.get(job_type.lower(), [])
        
        # If job type not found, try to match with the most relevant category
        if not required_skills:
            # Count matching skills in each category
            matches = {
                category: len(set(user_skills_lower) & set(skills_list))
                for category, skills_list in job_skills.items()
            }
            # Use the category with most matches
            best_match = max(matches.items(), key=lambda x: x[1])[0]
            required_skills = job_skills[best_match]
            logger.info(f"Job type '{job_type}' not found, using '{best_match}' based on skill matches")
        
        # Analyze skill match
        match_result = analyze_skills_match(user_skills_lower, required_skills)
        
        # Add skill levels and categories
        match_result['skill_levels'] = {
            'beginner': [skill for skill in match_result['matched_skills'] if any(s.get('level', '').lower() == 'beginner' for s in skills if s.get('name', '').lower() == skill)],
            'intermediate': [skill for skill in match_result['matched_skills'] if any(s.get('level', '').lower() == 'intermediate' for s in skills if s.get('name', '').lower() == skill)],
            'advanced': [skill for skill in match_result['matched_skills'] if any(s.get('level', '').lower() == 'advanced' for s in skills if s.get('name', '').lower() == skill)]
        }
        
        return match_result
        
    except Exception as e:
        logger.error(f"Error in analyze_skills: {str(e)}")
        return {
            'match_score': 0,
            'matched_skills': [],
            'missing_skills': [],
            'skill_levels': {
                'beginner': [],
                'intermediate': [],
                'advanced': []
            }
        }

def get_job_recommendations(skills, job_type):
    """Get job recommendations based on skills and job type"""
    try:
        # This would typically call an external job API
        # For now, return some example recommendations
        return [
            {
                'title': f'Senior {job_type.title()} Engineer',
                'company': 'Tech Company',
                'location': 'Remote',
                'description': f'Looking for experienced {job_type} professionals',
                'required_skills': skills[:3],
                'match_score': 85
            }
        ]
    except Exception as e:
        logger.error(f"Error in get_job_recommendations: {str(e)}")
        return []

def get_course_recommendations(missing_skills):
    """Get course recommendations for missing skills"""
    try:
        # This would typically call an external course API
        # For now, return some example recommendations
        return [
            {
                'name': f'Learn {skill.title()}',
                'provider': 'Online Learning Platform',
                'description': f'Master {skill} with hands-on projects',
                'skills_covered': [skill],
                'match_score': 90
            }
            for skill in missing_skills[:3]
        ]
    except Exception as e:
        logger.error(f"Error in get_course_recommendations: {str(e)}")
        return []

def get_fallback_recommendations(job_type, skills):
    """Get fallback recommendations when AI fails"""
    try:
        return {
            'job_recommendations': get_job_recommendations(skills, job_type),
            'course_recommendations': get_course_recommendations(skills),
            'certification_recommendations': []
        }
    except Exception as e:
        logger.error(f"Error in get_fallback_recommendations: {str(e)}")
        return {
            'job_recommendations': [],
            'course_recommendations': [],
            'certification_recommendations': []
        }

def fetch_udemy_courses(query, max_results=5):
    """Fetch courses from Udemy API"""
    try:
        api_key = os.getenv('UDEMY_API_KEY')
        if not api_key:
            logger.error("Udemy API key not found")
            return []
        
        url = f"https://www.udemy.com/api-2.0/courses/?search={query}&page_size={max_results}"
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Error fetching Udemy courses: {response.text}")
            return []
        
        courses = response.json().get('results', [])
        return [
            {
                'name': course.get('title'),
                'provider': 'Udemy',
                'description': course.get('description'),
                'link': course.get('url'),
                'match_score': 85
            }
            for course in courses
        ]
        
    except Exception as e:
        logger.error(f"Error in fetch_udemy_courses: {str(e)}")
        return []

@app.route('/')
def index():
    """Root endpoint"""
    return jsonify({
        'status': 'success',
        'message': 'AI Resume Analysis API is running'
    })

@app.route('/analyze', methods=['POST'])
async def analyze_resume():
    """Analyze resume and provide recommendations"""
    try:
        data = request.get_json()
        
        # Extract data from request
        text = data.get('text', '')
        job_type = data.get('job_type', '')
        skills = data.get('skills', [])
        education = data.get('education', [])
        experience = data.get('experience', [])
        location = data.get('location', '')
        
        # Validate required fields
        if not text or not job_type:
            return jsonify({
                'error': 'Missing required fields: text and job_type are required'
            }), 400
        
        # Analyze text quality
        text_quality = analyze_text_quality(text)
        
        # Analyze skills
        skills_analysis = analyze_skills(skills, job_type)
        
        # Get AI recommendations
        recommendations = await get_ai_recommendations(job_type, skills, education, experience, location)
        
        # Calculate overall score
        overall_score = calculate_overall_score(text_quality, recommendations)
        
        # Prepare response
        response = {
            'overall_score': overall_score,
            'text_quality': text_quality,
            'skills_analysis': skills_analysis,
            'education_score': calculate_education_score(education),
            'experience_score': calculate_experience_score(experience),
            'job_recommendations': recommendations.get('job_recommendations', []),
            'course_recommendations': recommendations.get('course_recommendations', []),
            'certification_recommendations': recommendations.get('certification_recommendations', [])
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in analyze_resume: {str(e)}")
        return jsonify({
            'error': 'An error occurred while analyzing the resume',
            'details': str(e)
        }), 500

def calculate_overall_score(text_quality, recommendations):
    """Calculate overall score based on various factors"""
    try:
        # Weight factors
        weights = {
            'text_quality': 0.2,
            'skills_match': 0.3,
            'education': 0.2,
            'experience': 0.3
        }
        
        # Calculate weighted score
        score = (
            text_quality.get('score', 0) * weights['text_quality'] +
            recommendations.get('skills_match_score', 0) * weights['skills_match'] +
            recommendations.get('education_score', 0) * weights['education'] +
            recommendations.get('experience_score', 0) * weights['experience']
        )
        
        return min(100, max(0, score))

    except Exception as e:
        logger.error(f"Error in calculate_overall_score: {str(e)}")
        return 0

if __name__ == '__main__':
    app.run(debug=True)
