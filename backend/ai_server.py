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
            "level": "Course level",
            "duration": "Course duration",
            "skills_covered": ["skill1", "skill2"],
            "prerequisites": ["prereq1"],
            "match_score": 90,
            "course_link": "Direct link to enroll",
            "instructor": "Course instructor",
            "rating": 4.5,
            "students_count": 1000
        }}
    ],
    "certification_recommendations": [
        {{
            "name": "Certification Name",
            "provider": "Certification Provider",
            "description": "Certification description",
            "level": "Certification level",
            "duration": "Time to complete",
            "skills_validated": ["skill1", "skill2"],
            "prerequisites": ["prereq1"],
            "match_score": 95,
            "cert_link": "Direct link to certification",
            "validity_period": "How long it's valid",
            "exam_format": "Exam format",
            "career_impact": "Impact on career"
        }}
    ]
}}"""

        # Get AI response
        response = await get_ai_response(prompt)
        
        if response.status_code == 200:
            try:
                # Parse the AI response
                ai_response = response.json()
                if isinstance(ai_response, list) and len(ai_response) > 0:
                    # Extract the generated text
                    generated_text = ai_response[0].get('generated_text', '')
                    # Parse the JSON response
                    recommendations = json.loads(generated_text)
                    
                    # Ensure minimum 3 job recommendations
                    if "job_recommendations" in recommendations:
                        if len(recommendations["job_recommendations"]) < 3:
                            # Add default job recommendations if needed
                            default_jobs = [
                                {
                                    "title": "Entry Level Software Developer",
                                    "company": "Tech Solutions Inc",
                                    "location": location if location else "Remote",
                                    "description": "Entry-level position for aspiring developers",
                                    "required_skills": ["Basic Programming", "Problem Solving"],
                                    "matched_skills": ["Basic Programming"],
                                    "missing_skills": ["Advanced Programming"],
                                    "match_score": 70,
                                    "salary_range": "$50,000 - $70,000",
                                    "job_link": "https://example.com/job1",
                                    "experience_level": "Entry Level",
                                    "match_details": "Good match for beginners"
                                },
                                {
                                    "title": "Junior Web Developer",
                                    "company": "WebTech Corp",
                                    "location": location if location else "Remote",
                                    "description": "Junior web development position",
                                    "required_skills": ["HTML", "CSS", "JavaScript"],
                                    "matched_skills": ["HTML", "CSS"],
                                    "missing_skills": ["JavaScript"],
                                    "match_score": 65,
                                    "salary_range": "$45,000 - $65,000",
                                    "job_link": "https://example.com/job2",
                                    "experience_level": "Junior",
                                    "match_details": "Suitable for beginners"
                                },
                                {
                                    "title": "IT Support Specialist",
                                    "company": "IT Solutions Ltd",
                                    "location": location if location else "Remote",
                                    "description": "Entry-level IT support role",
                                    "required_skills": ["Basic IT", "Customer Service"],
                                    "matched_skills": ["Basic IT"],
                                    "missing_skills": ["Customer Service"],
                                    "match_score": 60,
                                    "salary_range": "$40,000 - $60,000",
                                    "job_link": "https://example.com/job3",
                                    "experience_level": "Entry Level",
                                    "match_details": "Good starting position"
                                }
                            ]
                            recommendations["job_recommendations"].extend(default_jobs[:3 - len(recommendations["job_recommendations"])])
                    
                    # Filter course and certification recommendations based on user level
                    if "course_recommendations" in recommendations:
                        recommendations["course_recommendations"] = [
                            course for course in recommendations["course_recommendations"]
                            if course.get("level", "").lower() == user_level.lower()
                        ]
                        
                        # Ensure minimum 3 course recommendations
                        if len(recommendations["course_recommendations"]) < 3:
                            # Add default course recommendations if needed
                            default_courses = [
                                {
                                    "name": "Introduction to Programming",
                                    "provider": "Coursera",
                                    "description": "Learn the fundamentals of programming",
                                    "level": "beginner",
                                    "duration": "8 weeks",
                                    "skills_covered": ["Programming Basics", "Problem Solving"],
                                    "prerequisites": [],
                                    "match_score": 85,
                                    "course_link": "https://www.coursera.org/learn/intro-programming",
                                    "instructor": "Dr. Jane Smith",
                                    "rating": 4.5,
                                    "students_count": 10000
                                },
                                {
                                    "name": "Web Development Fundamentals",
                                    "provider": "edX",
                                    "description": "Master the basics of web development",
                                    "level": "beginner",
                                    "duration": "12 weeks",
                                    "skills_covered": ["HTML", "CSS", "JavaScript"],
                                    "prerequisites": [],
                                    "match_score": 80,
                                    "course_link": "https://www.edx.org/course/web-development",
                                    "instructor": "Prof. John Doe",
                                    "rating": 4.3,
                                    "students_count": 8000
                                },
                                {
                                    "name": "Data Science for Beginners",
                                    "provider": "Udacity",
                                    "description": "Introduction to data science concepts",
                                    "level": "beginner",
                                    "duration": "10 weeks",
                                    "skills_covered": ["Python", "Data Analysis", "Statistics"],
                                    "prerequisites": [],
                                    "match_score": 75,
                                    "course_link": "https://www.udacity.com/course/data-science",
                                    "instructor": "Dr. Sarah Johnson",
                                    "rating": 4.4,
                                    "students_count": 12000
                                }
                            ]
                            recommendations["course_recommendations"].extend(default_courses[:3 - len(recommendations["course_recommendations"])])
                    
                    if "certification_recommendations" in recommendations:
                        recommendations["certification_recommendations"] = [
                            cert for cert in recommendations["certification_recommendations"]
                            if cert.get("level", "").lower() == user_level.lower()
                        ]
                        
                        # Ensure minimum 3 certification recommendations
                        if len(recommendations["certification_recommendations"]) < 3:
                            # Add default certification recommendations if needed
                            default_certs = [
                                {
                                    "name": "CompTIA IT Fundamentals",
                                    "provider": "CompTIA",
                                    "description": "Entry-level IT certification",
                                    "level": "beginner",
                                    "duration": "3 months",
                                    "skills_validated": ["IT Basics", "Hardware", "Software"],
                                    "prerequisites": [],
                                    "match_score": 85,
                                    "cert_link": "https://www.comptia.org/certifications/it-fundamentals",
                                    "validity_period": "Lifetime",
                                    "exam_format": "Multiple Choice",
                                    "career_impact": "Good for IT career start"
                                },
                                {
                                    "name": "Google IT Support",
                                    "provider": "Google",
                                    "description": "Entry-level IT support certification",
                                    "level": "beginner",
                                    "duration": "6 months",
                                    "skills_validated": ["IT Support", "Troubleshooting", "Networking"],
                                    "prerequisites": [],
                                    "match_score": 80,
                                    "cert_link": "https://www.coursera.org/professional-certificates/google-it-support",
                                    "validity_period": "Lifetime",
                                    "exam_format": "Project-based",
                                    "career_impact": "High demand in IT support"
                                },
                                {
                                    "name": "Microsoft Technology Associate",
                                    "provider": "Microsoft",
                                    "description": "Entry-level Microsoft technology certification",
                                    "level": "beginner",
                                    "duration": "3 months",
                                    "skills_validated": ["Windows", "Office", "Networking"],
                                    "prerequisites": [],
                                    "match_score": 75,
                                    "cert_link": "https://www.microsoft.com/en-us/learning/mta-certification.aspx",
                                    "validity_period": "Lifetime",
                                    "exam_format": "Multiple Choice",
                                    "career_impact": "Good for Microsoft ecosystem"
                                }
                            ]
                            recommendations["certification_recommendations"].extend(default_certs[:3 - len(recommendations["certification_recommendations"])])
                    
                    # Log detailed analysis of recommendations
                    log_recommendation_analysis(recommendations, education, experience, skills)
                    
                    return recommendations
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing AI response: {str(e)}")
                return None
        else:
            logger.error(f"HuggingFace API error: {response.status_code}")
            return None

    except Exception as e:
        logger.error(f"Error getting AI recommendations: {str(e)}")
        return None

def determine_user_level(skills, experience):
    """Determine user's skill level based on experience and skills"""
    try:
        # Calculate total years of experience
        total_years = sum(
            float(exp.get('duration', '0').split()[0])
            for exp in experience
            if exp.get('duration')
        )
        
        # Check for level indicators in skills
        has_advanced = any(
            'senior' in skill.get('name', '').lower() or
            'expert' in skill.get('name', '').lower() or
            'advanced' in skill.get('name', '').lower()
            for skill in skills
        )
        
        has_beginner = any(
            'junior' in skill.get('name', '').lower() or
            'beginner' in skill.get('name', '').lower() or
            'entry' in skill.get('name', '').lower()
            for skill in skills
        )
        
        # Determine level based on experience and skill indicators
        if total_years >= 5 or has_advanced:
            return "advanced"
        elif total_years >= 2 and not has_beginner:
            return "intermediate"
        else:
            return "beginner"
            
    except Exception as e:
        logger.error(f"Error determining user level: {str(e)}")
        return "beginner"  # Default to beginner if there's an error

def log_recommendation_analysis(recommendations, education, experience, skills):
    """Log detailed analysis of recommendation relevance"""
    try:
        logger.info("=== Recommendation Analysis ===")
        
        # Education Analysis
        logger.info("Education Profile:")
        logger.info(f"- Background: {education}")
        
        # Experience Analysis
        logger.info("Experience Profile:")
        logger.info(f"- Background: {experience}")
        
        # Skills Analysis
        logger.info("Skills Profile:")
        logger.info(f"- Core Skills: {', '.join(skills)}")
        
        # Job Recommendations Analysis
        if "job_recommendations" in recommendations:
            logger.info("\nJob Recommendations Analysis:")
            for job in recommendations["job_recommendations"]:
                logger.info(f"\nRole: {job['title']}")
                logger.info(f"Match: {job['match_percentage']}%")
                logger.info(f"Industry: {job['location']}")
                logger.info("Required Skills Match: " + 
                          str(len(set(skills) & set(job['required_skills']))) + 
                          f" out of {len(job['required_skills'])}")
                
        # Course Recommendations Analysis
        if "course_recommendations" in recommendations:
            logger.info("\nCourse Recommendations Analysis:")
            for course in recommendations["course_recommendations"]:
                logger.info(f"\nCourse: {course['name']}")
                logger.info(f"Provider: {course['provider']}")
                logger.info(f"Level: {course['level']}")
                logger.info(f"Relevance: Maps to {len(set(skills) & set(course['skills_covered']))} current skills")
                
        # Certification Recommendations Analysis
        if "certification_recommendations" in recommendations:
            logger.info("\nCertification Recommendations Analysis:")
            for cert in recommendations["certification_recommendations"]:
                logger.info(f"\nCertification: {cert['name']}")
                logger.info(f"Provider: {cert['provider']}")
                logger.info(f"Level: {cert['level']}")
                logger.info(f"Prerequisites Match: {all(skill in skills for skill in cert['prerequisites'])}")
                
        # Market Analysis
        if "market_analysis" in recommendations:
            logger.info("\nMarket Analysis:")
            logger.info(f"Current Demand: {recommendations['market_analysis']['demand']}")
            logger.info(f"Growth Projection: {recommendations['market_analysis']['growth_projection']}")
            logger.info(f"Salary Trends: {recommendations['market_analysis']['salary_trends']}")
            
        logger.info("\n=== End Analysis ===")
        
    except Exception as e:
        logger.error(f"Error in recommendation analysis logging: {str(e)}")

def validate_unique_recommendations(recommendations):
    """Ensure recommendations are unique and meet diversity requirements"""
    try:
        # Track overall provider diversity
        all_providers = []
        
        if "job_recommendations" in recommendations:
            # Track seen jobs and match percentages
            seen_jobs = set()
            unique_jobs = []
            match_percentages = []
            industries = set()
            
            for job in recommendations["job_recommendations"]:
                job_key = job["title"].lower()
                if job_key not in seen_jobs:
                    # Validate and adjust match percentage
                    match_percentage = job["match_percentage"]
                    if match_percentages:
                        # Ensure at least 5% difference between match percentages
                        while any(abs(match_percentage - m) < 5 for m in match_percentages):
                            match_percentage = max(30, min(95, match_percentage + 3))
                    match_percentages.append(match_percentage)
                    job["match_percentage"] = match_percentage
                    
                    # Track industry diversity
                    if "location" in job:
                        industries.add(job["location"].lower())
                    
                    seen_jobs.add(job_key)
                    unique_jobs.append(job)
            
            # Ensure minimum diversity requirements
            if len(unique_jobs) < 3:
                logger.warning("Not enough unique job recommendations")
            if len(industries) < 2:
                logger.warning("Low industry diversity in job recommendations")
            
            recommendations["job_recommendations"] = unique_jobs

        if "course_recommendations" in recommendations:
            # Track seen courses and providers
            seen_courses = set()
            unique_courses = []
            course_providers = set()
            course_levels = set()
            
            for course in recommendations["course_recommendations"]:
                course_key = f"{course['name']}_{course['provider']}".lower()
                if course_key not in seen_courses:
                    # Track provider diversity
                    provider = course["provider"].lower()
                    course_providers.add(provider)
                    all_providers.append(provider)
                    
                    # Track level diversity
                    if "level" in course:
                        course_levels.add(course["level"].lower())
                    
                    seen_courses.add(course_key)
                    unique_courses.append(course)
            
            # Ensure minimum diversity requirements
            if len(unique_courses) < 3:
                logger.warning("Not enough unique course recommendations")
            if len(course_providers) < 2:
                logger.warning("Low provider diversity in course recommendations")
            if len(course_levels) < 2:
                logger.warning("Low level diversity in course recommendations")
            
            recommendations["course_recommendations"] = unique_courses

        if "certification_recommendations" in recommendations:
            # Track seen certifications and providers
            seen_certs = set()
            unique_certs = []
            cert_providers = set()
            cert_levels = set()
            
            for cert in recommendations["certification_recommendations"]:
                cert_key = f"{cert['name']}_{cert['provider']}".lower()
                if cert_key not in seen_certs:
                    # Track provider diversity
                    provider = cert["provider"].lower()
                    cert_providers.add(provider)
                    all_providers.append(provider)
                    
                    # Track level diversity
                    if "level" in cert:
                        cert_levels.add(cert["level"].lower())
                    
                    seen_certs.add(cert_key)
                    unique_certs.append(cert)
            
            # Ensure minimum diversity requirements
            if len(unique_certs) < 3:
                logger.warning("Not enough unique certification recommendations")
            if len(cert_providers) < 2:
                logger.warning("Low provider diversity in certification recommendations")
            if len(cert_levels) < 2:
                logger.warning("Low level diversity in certification recommendations")
            
            recommendations["certification_recommendations"] = unique_certs

        # Analyze overall provider diversity
        provider_counts = {}
        for provider in all_providers:
            provider_counts[provider] = provider_counts.get(provider, 0) + 1
        
        # Check for provider overuse
        for provider, count in provider_counts.items():
            if count > 2:  # If same provider used more than twice
                logger.warning(f"Provider '{provider}' appears {count} times across recommendations")

        return recommendations
    except Exception as e:
        logger.error(f"Error validating recommendations: {str(e)}")
        return recommendations

def analyze_text_quality(text):
    """Analyze text quality using ML models"""
    try:
        # Basic metrics
        sentences = text.split('.')
        words = text.split()
        avg_word_length = np.mean([len(word) for word in words])
        
        # Calculate readability score (simplified)
        readability_score = 100 - (avg_word_length * 10)
        
        # Sentiment analysis
        if sentiment_analyzer:
            sentiment_result = sentiment_analyzer(text[:512])[0]  # Limit text length
            sentiment_score = float(sentiment_result['score'])
        else:
            sentiment_score = 0.5  # Neutral sentiment as fallback
        
        return {
            "sentence_count": len(sentences),
            "word_count": len(words),
            "avg_word_length": round(avg_word_length, 2),
            "readability_score": round(readability_score, 2),
            "sentiment_score": round(sentiment_score, 2)
        }
    except Exception as e:
        logger.error(f"Error in text quality analysis: {str(e)}")
        return {
            "sentence_count": 0,
            "word_count": 0,
            "avg_word_length": 0,
            "readability_score": 0,
            "sentiment_score": 0.5
        }

def analyze_skills_match(user_skills, required_skills):
    """Analyze skills match using ML"""
    try:
        if not sentence_model:
            return {"match_percentage": 0, "missing_skills": required_skills}
            
        # Convert skills to embeddings
        user_embeddings = sentence_model.encode(user_skills)
        required_embeddings = sentence_model.encode(required_skills)
        
        # Calculate similarity matrix
        similarity_matrix = cosine_similarity(user_embeddings, required_embeddings)
        
        # Find matches
        matches = []
        missing_skills = []
        
        for i, req_skill in enumerate(required_skills):
            max_similarity = max(similarity_matrix[:, i])
            if max_similarity > 0.5:  # Threshold for considering skills as matched
                matches.append(req_skill)
            else:
                missing_skills.append(req_skill)
        
        match_percentage = (len(matches) / len(required_skills)) * 100
        
        return {
            "match_percentage": round(match_percentage, 2),
            "missing_skills": missing_skills
        }
    except Exception as e:
        logger.error(f"Error in skills match analysis: {str(e)}")
        return {"match_percentage": 0, "missing_skills": required_skills}

def analyze_skills(skills, job_type):
    """Analyze skills relevance and market demand"""
    try:
        if not sentence_model:
            return {
                "relevant_skills": [],
                "market_demand": "Unknown",
                "growth_potential": "Unknown"
            }
            
        # Get job market data
        job_data = JOB_MARKET.get(job_type.lower(), {
            "required_skills": [],
            "market_demand": "Unknown",
            "growth_potential": "Unknown"
        })
        
        # Analyze skills relevance
        relevant_skills = []
        for skill in skills:
            if skill.lower() in [s.lower() for s in job_data["required_skills"]]:
                relevant_skills.append(skill)
        
        return {
            "relevant_skills": relevant_skills,
            "market_demand": job_data["market_demand"],
            "growth_potential": job_data["growth_potential"]
        }
    except Exception as e:
        logger.error(f"Error in skills analysis: {str(e)}")
        return {
            "relevant_skills": [],
            "market_demand": "Unknown",
            "growth_potential": "Unknown"
        }

def get_job_recommendations(skills, job_type):
    """Get job recommendations based on skills and job type"""
    try:
        if not sentence_model:
            return []
            
        recommendations = []
        for job, data in JOB_MARKET.items():
            if job_type.lower() in job.lower():
                match_result = analyze_skills_match(skills, data["required_skills"])
                recommendations.append({
                    "job_title": job,
                    "match_percentage": match_result["match_percentage"],
                    "missing_skills": match_result["missing_skills"],
                    "salary_range": data["salary_range"],
                    "description": data["description"]
                })
        
        # Sort by match percentage
        recommendations.sort(key=lambda x: x["match_percentage"], reverse=True)
        return recommendations[:3]  # Return top 3 recommendations
    except Exception as e:
        logger.error(f"Error in job recommendations: {str(e)}")
        return []

def get_course_recommendations(missing_skills):
    """Get course recommendations for missing skills"""
    try:
        if not sentence_model:
            return []
            
        # Sample course data (in a real application, this would come from a database)
        courses = {
            "Python": ["Python Programming Fundamentals", "Advanced Python Development"],
            "JavaScript": ["JavaScript Basics", "Modern JavaScript Development"],
            "SQL": ["SQL Fundamentals", "Advanced Database Management"],
            "Machine Learning": ["Introduction to Machine Learning", "Deep Learning Fundamentals"],
            "React": ["React Basics", "Advanced React Development"],
            "Node.js": ["Node.js Fundamentals", "Full Stack Development with Node.js"]
        }
        
        recommendations = []
        for skill in missing_skills:
            if skill in courses:
                recommendations.extend(courses[skill])
        
        return list(set(recommendations))  # Remove duplicates
    except Exception as e:
        logger.error(f"Error in course recommendations: {str(e)}")
        return []

def get_fallback_recommendations(job_type, skills):
    """Get fallback recommendations using hardcoded data"""
    try:
        job_data = JOB_MARKET.get(job_type.lower(), {
            "required_skills": [],
            "market_demand": "Unknown",
            "growth_potential": "Unknown"
        })
        
        return {
            "job_recommendations": [{
                "job_title": job_type,
                "match_percentage": 70,
                "salary_range": job_data.get("salary_range", "Unknown"),
                "description": job_data.get("description", "No description available")
            }],
            "course_recommendations": [
                {
                    "title": "Introduction to Programming",
                    "provider": "Coursera",
                    "description": "Basic programming concepts",
                    "level": "Beginner",
                    "link": "https://www.coursera.org"
                }
            ],
            "certification_recommendations": [
                {
                    "title": "Professional Certification",
                    "provider": "Industry Standard",
                    "description": "Professional certification",
                    "level": "Professional",
                    "link": "https://example.com"
                }
            ],
            "market_analysis": {
                "demand": job_data.get("market_demand", "Unknown"),
                "growth_potential": job_data.get("growth_potential", "Unknown"),
                "salary_trends": "Stable"
            }
        }
    except Exception as e:
        logger.error(f"Error in fallback recommendations: {str(e)}")
        return None

def fetch_udemy_courses(query, max_results=5):
    """Fetch course data from Udemy API"""
    try:
        headers = {
            'Authorization': f'Basic {UDEMY_API_KEY}:{UDEMY_CLIENT_ID}',
            'Content-Type': 'application/json'
        }
        
        params = {
            'search': query,
            'page_size': max_results,
            'ordering': 'highest-rated',
            'language': 'en',
            'price': 'price-paid,price-free'
        }
        
        response = requests.get(
            f'{UDEMY_BASE_URL}/courses/',
            headers=headers,
            params=params
        )
        
        if response.status_code == 200:
            data = response.json()
            courses = []
            
            for course in data.get('results', []):
                # Extract course URL
                course_url = course.get('url', '')
                if not course_url:
                    continue
                    
                # Clean up the URL
                course_url = course_url.strip('/')
                if not course_url.startswith('http'):
                    course_url = f"https://www.udemy.com/course/{course_url}"
                
                # Format duration
                duration = course.get('content_info', '')
                if duration:
                    duration = duration.replace(' hours', 'h').replace(' hour', 'h')
                
                courses.append({
                    'title': course.get('title'),
                    'description': course.get('description'),
                    'udemy_link': course_url,
                    'level': course.get('instructional_level', 'All Levels'),
                    'duration': duration,
                    'rating': round(float(course.get('rating', 0)), 1),
                    'price': course.get('price', 'N/A'),
                    'instructor': course.get('visible_instructors', [{}])[0].get('display_name', 'N/A'),
                    'last_updated': course.get('last_update_date', 'N/A'),
                    'language': course.get('locale', {}).get('title', 'English'),
                    'students_count': course.get('num_subscribers', 0),
                    'reviews_count': course.get('num_reviews', 0)
                })
            
            # Remove duplicates based on title
            seen_titles = set()
            unique_courses = []
            for course in courses:
                title = course['title'].lower()
                if title not in seen_titles:
                    seen_titles.add(title)
                    unique_courses.append(course)
            
            return unique_courses
        else:
            logger.error(f"Udemy API error: {response.status_code}")
            return []
            
    except Exception as e:
        logger.error(f"Error fetching Udemy courses: {str(e)}")
        return []

@app.route('/')
def index():
    """Check server status and ML model availability"""
    return jsonify({
        "status": "running",
        "ml_models_loaded": bool(sentence_model and sentiment_analyzer)
    })

@app.route('/analyze', methods=['POST'])
async def analyze_resume():
    """Analyze resume data and provide insights"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Extract data from request
        job_type = data.get('job_type', '')
        skills = data.get('skills', [])
        education = data.get('education', [])
        experience = data.get('experience', [])
        location = data.get('location', '')
        text = data.get('text', '')
        
        # Log input data
        logger.info("=== Processing New Resume ===")
        logger.info(f"Education: {education}")
        logger.info(f"Experience: {experience}")
        logger.info(f"Skills: {', '.join([skill.get('name', '') for skill in skills])}")
        logger.info(f"Target Job Type: {job_type}")
        
        # Analyze text quality
        text_quality = analyze_text_quality(text)
        logger.info(f"Text Quality Analysis: {text_quality}")
        
        # Get AI recommendations
        recommendations = await get_ai_recommendations(job_type, skills, education, experience, location)
        
        if not recommendations:
            logger.error("Failed to generate recommendations")
            recommendations = {
                "job_recommendations": [],
                "course_recommendations": [],
                "certification_recommendations": [],
                "market_analysis": {
                    "demand": "Unknown",
                    "growth_projection": "Unknown",
                    "salary_trends": "Unknown"
                }
            }

        # Calculate skills match score
        skills_analysis = analyze_skills(skills, job_type)
        logger.info(f"Skills Analysis: {skills_analysis}")
        
        # Calculate scores
        education_score = calculate_education_score(education)
        experience_score = calculate_experience_score(experience)
        
        # Calculate overall score
        overall_score = (
            text_quality.get("readability_score", 0) * 0.2 +
            (skills_analysis.get("match_percentage", 0) or 0) * 0.3 +
            education_score * 0.25 +
            experience_score * 0.25
        )
        
        # Prepare response
        response = {
            "overall_score": round(overall_score, 2),
            "text_quality": {
                "score": text_quality.get("readability_score", 0),
                "readability": text_quality.get("readability_level", "Good"),
                "clarity": text_quality.get("clarity_level", "Good")
            },
            "skills_analysis": {
                "matched_skills": skills_analysis.get("relevant_skills", []),
                "missing_skills": skills_analysis.get("missing_skills", []),
                "skills_match_score": skills_analysis.get("match_percentage", 0)
            },
            "education_score": education_score,
            "experience_score": experience_score,
            "job_recommendations": recommendations.get("job_recommendations", []),
            "course_recommendations": recommendations.get("course_recommendations", []),
            "certification_recommendations": recommendations.get("certification_recommendations", []),
            "market_analysis": recommendations.get("market_analysis", {
                "demand": "Unknown",
                "growth_projection": "Unknown",
                "salary_trends": "Unknown"
            })
        }
        
        logger.info("=== Resume Analysis Complete ===")
        logger.info(f"Response: {json.dumps(response, indent=2)}")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Error in resume analysis: {str(e)}")
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
            "level": "Course level",
            "duration": "Course duration",
            "skills_covered": ["skill1", "skill2"],
            "prerequisites": ["prereq1"],
            "match_score": 90,
            "course_link": "Direct link to enroll",
            "instructor": "Course instructor",
            "rating": 4.5,
            "students_count": 1000
        }}
    ],
    "certification_recommendations": [
        {{
            "name": "Certification Name",
            "provider": "Certification Provider",
            "description": "Certification description",
            "level": "Certification level",
            "duration": "Time to complete",
            "skills_validated": ["skill1", "skill2"],
            "prerequisites": ["prereq1"],
            "match_score": 95,
            "cert_link": "Direct link to certification",
            "validity_period": "How long it's valid",
            "exam_format": "Exam format",
            "career_impact": "Impact on career"
        }}
    ]
}}"""

        # Get AI response
        response = await get_ai_response(prompt)
        
        if response.status_code == 200:
            try:
                # Parse the AI response
                ai_response = response.json()
                if isinstance(ai_response, list) and len(ai_response) > 0:
                    # Extract the generated text
                    generated_text = ai_response[0].get('generated_text', '')
                    # Parse the JSON response
                    recommendations = json.loads(generated_text)
                    
                    # Ensure minimum 3 job recommendations
                    if "job_recommendations" in recommendations:
                        if len(recommendations["job_recommendations"]) < 3:
                            # Add default job recommendations if needed
                            default_jobs = [
                                {
                                    "title": "Entry Level Software Developer",
                                    "company": "Tech Solutions Inc",
                                    "location": location if location else "Remote",
                                    "description": "Entry-level position for aspiring developers",
                                    "required_skills": ["Basic Programming", "Problem Solving"],
                                    "matched_skills": ["Basic Programming"],
                                    "missing_skills": ["Advanced Programming"],
                                    "match_score": 70,
                                    "salary_range": "$50,000 - $70,000",
                                    "job_link": "https://example.com/job1",
                                    "experience_level": "Entry Level",
                                    "match_details": "Good match for beginners"
                                },
                                {
                                    "title": "Junior Web Developer",
                                    "company": "WebTech Corp",
                                    "location": location if location else "Remote",
                                    "description": "Junior web development position",
                                    "required_skills": ["HTML", "CSS", "JavaScript"],
                                    "matched_skills": ["HTML", "CSS"],
                                    "missing_skills": ["JavaScript"],
                                    "match_score": 65,
                                    "salary_range": "$45,000 - $65,000",
                                    "job_link": "https://example.com/job2",
                                    "experience_level": "Junior",
                                    "match_details": "Suitable for beginners"
                                },
                                {
                                    "title": "IT Support Specialist",
                                    "company": "IT Solutions Ltd",
                                    "location": location if location else "Remote",
                                    "description": "Entry-level IT support role",
                                    "required_skills": ["Basic IT", "Customer Service"],
                                    "matched_skills": ["Basic IT"],
                                    "missing_skills": ["Customer Service"],
                                    "match_score": 60,
                                    "salary_range": "$40,000 - $60,000",
                                    "job_link": "https://example.com/job3",
                                    "experience_level": "Entry Level",
                                    "match_details": "Good starting position"
                                }
                            ]
                            recommendations["job_recommendations"].extend(default_jobs[:3 - len(recommendations["job_recommendations"])])
                    
                    # Filter course and certification recommendations based on user level
                    if "course_recommendations" in recommendations:
                        recommendations["course_recommendations"] = [
                            course for course in recommendations["course_recommendations"]
                            if course.get("level", "").lower() == user_level.lower()
                        ]
                        
                        # Ensure minimum 3 course recommendations
                        if len(recommendations["course_recommendations"]) < 3:
                            # Add default course recommendations if needed
                            default_courses = [
                                {
                                    "name": "Introduction to Programming",
                                    "provider": "Coursera",
                                    "description": "Learn the fundamentals of programming",
                                    "level": "beginner",
                                    "duration": "8 weeks",
                                    "skills_covered": ["Programming Basics", "Problem Solving"],
                                    "prerequisites": [],
                                    "match_score": 85,
                                    "course_link": "https://www.coursera.org/learn/intro-programming",
                                    "instructor": "Dr. Jane Smith",
                                    "rating": 4.5,
                                    "students_count": 10000
                                },
                                {
                                    "name": "Web Development Fundamentals",
                                    "provider": "edX",
                                    "description": "Master the basics of web development",
                                    "level": "beginner",
                                    "duration": "12 weeks",
                                    "skills_covered": ["HTML", "CSS", "JavaScript"],
                                    "prerequisites": [],
                                    "match_score": 80,
                                    "course_link": "https://www.edx.org/course/web-development",
                                    "instructor": "Prof. John Doe",
                                    "rating": 4.3,
                                    "students_count": 8000
                                },
                                {
                                    "name": "Data Science for Beginners",
                                    "provider": "Udacity",
                                    "description": "Introduction to data science concepts",
                                    "level": "beginner",
                                    "duration": "10 weeks",
                                    "skills_covered": ["Python", "Data Analysis", "Statistics"],
                                    "prerequisites": [],
                                    "match_score": 75,
                                    "course_link": "https://www.udacity.com/course/data-science",
                                    "instructor": "Dr. Sarah Johnson",
                                    "rating": 4.4,
                                    "students_count": 12000
                                }
                            ]
                            recommendations["course_recommendations"].extend(default_courses[:3 - len(recommendations["course_recommendations"])])
                    
                    if "certification_recommendations" in recommendations:
                        recommendations["certification_recommendations"] = [
                            cert for cert in recommendations["certification_recommendations"]
                            if cert.get("level", "").lower() == user_level.lower()
                        ]
                        
                        # Ensure minimum 3 certification recommendations
                        if len(recommendations["certification_recommendations"]) < 3:
                            # Add default certification recommendations if needed
                            default_certs = [
                                {
                                    "name": "CompTIA IT Fundamentals",
                                    "provider": "CompTIA",
                                    "description": "Entry-level IT certification",
                                    "level": "beginner",
                                    "duration": "3 months",
                                    "skills_validated": ["IT Basics", "Hardware", "Software"],
                                    "prerequisites": [],
                                    "match_score": 85,
                                    "cert_link": "https://www.comptia.org/certifications/it-fundamentals",
                                    "validity_period": "Lifetime",
                                    "exam_format": "Multiple Choice",
                                    "career_impact": "Good for IT career start"
                                },
                                {
                                    "name": "Google IT Support",
                                    "provider": "Google",
                                    "description": "Entry-level IT support certification",
                                    "level": "beginner",
                                    "duration": "6 months",
                                    "skills_validated": ["IT Support", "Troubleshooting", "Networking"],
                                    "prerequisites": [],
                                    "match_score": 80,
                                    "cert_link": "https://www.coursera.org/professional-certificates/google-it-support",
                                    "validity_period": "Lifetime",
                                    "exam_format": "Project-based",
                                    "career_impact": "High demand in IT support"
                                },
                                {
                                    "name": "Microsoft Technology Associate",
                                    "provider": "Microsoft",
                                    "description": "Entry-level Microsoft technology certification",
                                    "level": "beginner",
                                    "duration": "3 months",
                                    "skills_validated": ["Windows", "Office", "Networking"],
                                    "prerequisites": [],
                                    "match_score": 75,
                                    "cert_link": "https://www.microsoft.com/en-us/learning/mta-certification.aspx",
                                    "validity_period": "Lifetime",
                                    "exam_format": "Multiple Choice",
                                    "career_impact": "Good for Microsoft ecosystem"
                                }
                            ]
                            recommendations["certification_recommendations"].extend(default_certs[:3 - len(recommendations["certification_recommendations"])])
                    
                    # Log detailed analysis of recommendations
                    log_recommendation_analysis(recommendations, education, experience, skills)
                    
                    return recommendations
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing AI response: {str(e)}")
                return None
        else:
            logger.error(f"HuggingFace API error: {response.status_code}")
            return None

    except Exception as e:
        logger.error(f"Error getting AI recommendations: {str(e)}")
        return None

def determine_user_level(skills, experience):
    """Determine user's skill level based on experience and skills"""
    try:
        # Calculate total years of experience
        total_years = sum(
            float(exp.get('duration', '0').split()[0])
            for exp in experience
            if exp.get('duration')
        )
        
        # Check for level indicators in skills
        has_advanced = any(
            'senior' in skill.get('name', '').lower() or
            'expert' in skill.get('name', '').lower() or
            'advanced' in skill.get('name', '').lower()
            for skill in skills
        )
        
        has_beginner = any(
            'junior' in skill.get('name', '').lower() or
            'beginner' in skill.get('name', '').lower() or
            'entry' in skill.get('name', '').lower()
            for skill in skills
        )
        
        # Determine level based on experience and skill indicators
        if total_years >= 5 or has_advanced:
            return "advanced"
        elif total_years >= 2 and not has_beginner:
            return "intermediate"
        else:
            return "beginner"
            
    except Exception as e:
        logger.error(f"Error determining user level: {str(e)}")
        return "beginner"  # Default to beginner if there's an error

def log_recommendation_analysis(recommendations, education, experience, skills):
    """Log detailed analysis of recommendation relevance"""
    try:
        logger.info("=== Recommendation Analysis ===")
        
        # Education Analysis
        logger.info("Education Profile:")
        logger.info(f"- Background: {education}")
        
        # Experience Analysis
        logger.info("Experience Profile:")
        logger.info(f"- Background: {experience}")
        
        # Skills Analysis
        logger.info("Skills Profile:")
        logger.info(f"- Core Skills: {', '.join(skills)}")
        
        # Job Recommendations Analysis
        if "job_recommendations" in recommendations:
            logger.info("\nJob Recommendations Analysis:")
            for job in recommendations["job_recommendations"]:
                logger.info(f"\nRole: {job['title']}")
                logger.info(f"Match: {job['match_percentage']}%")
                logger.info(f"Industry: {job['location']}")
                logger.info("Required Skills Match: " + 
                          str(len(set(skills) & set(job['required_skills']))) + 
                          f" out of {len(job['required_skills'])}")
                
        # Course Recommendations Analysis
        if "course_recommendations" in recommendations:
            logger.info("\nCourse Recommendations Analysis:")
            for course in recommendations["course_recommendations"]:
                logger.info(f"\nCourse: {course['name']}")
                logger.info(f"Provider: {course['provider']}")
                logger.info(f"Level: {course['level']}")
                logger.info(f"Relevance: Maps to {len(set(skills) & set(course['skills_covered']))} current skills")
                
        # Certification Recommendations Analysis
        if "certification_recommendations" in recommendations:
            logger.info("\nCertification Recommendations Analysis:")
            for cert in recommendations["certification_recommendations"]:
                logger.info(f"\nCertification: {cert['name']}")
                logger.info(f"Provider: {cert['provider']}")
                logger.info(f"Level: {cert['level']}")
                logger.info(f"Prerequisites Match: {all(skill in skills for skill in cert['prerequisites'])}")
                
        # Market Analysis
        if "market_analysis" in recommendations:
            logger.info("\nMarket Analysis:")
            logger.info(f"Current Demand: {recommendations['market_analysis']['demand']}")
            logger.info(f"Growth Projection: {recommendations['market_analysis']['growth_projection']}")
            logger.info(f"Salary Trends: {recommendations['market_analysis']['salary_trends']}")
            
        logger.info("\n=== End Analysis ===")
        
    except Exception as e:
        logger.error(f"Error in recommendation analysis logging: {str(e)}")

def validate_unique_recommendations(recommendations):
    """Ensure recommendations are unique and meet diversity requirements"""
    try:
        # Track overall provider diversity
        all_providers = []
        
        if "job_recommendations" in recommendations:
            # Track seen jobs and match percentages
            seen_jobs = set()
            unique_jobs = []
            match_percentages = []
            industries = set()
            
            for job in recommendations["job_recommendations"]:
                job_key = job["title"].lower()
                if job_key not in seen_jobs:
                    # Validate and adjust match percentage
                    match_percentage = job["match_percentage"]
                    if match_percentages:
                        # Ensure at least 5% difference between match percentages
                        while any(abs(match_percentage - m) < 5 for m in match_percentages):
                            match_percentage = max(30, min(95, match_percentage + 3))
                    match_percentages.append(match_percentage)
                    job["match_percentage"] = match_percentage
                    
                    # Track industry diversity
                    if "location" in job:
                        industries.add(job["location"].lower())
                    
                    seen_jobs.add(job_key)
                    unique_jobs.append(job)
            
            # Ensure minimum diversity requirements
            if len(unique_jobs) < 3:
                logger.warning("Not enough unique job recommendations")
            if len(industries) < 2:
                logger.warning("Low industry diversity in job recommendations")
            
            recommendations["job_recommendations"] = unique_jobs

        if "course_recommendations" in recommendations:
            # Track seen courses and providers
            seen_courses = set()
            unique_courses = []
            course_providers = set()
            course_levels = set()
            
            for course in recommendations["course_recommendations"]:
                course_key = f"{course['name']}_{course['provider']}".lower()
                if course_key not in seen_courses:
                    # Track provider diversity
                    provider = course["provider"].lower()
                    course_providers.add(provider)
                    all_providers.append(provider)
                    
                    # Track level diversity
                    if "level" in course:
                        course_levels.add(course["level"].lower())
                    
                    seen_courses.add(course_key)
                    unique_courses.append(course)
            
            # Ensure minimum diversity requirements
            if len(unique_courses) < 3:
                logger.warning("Not enough unique course recommendations")
            if len(course_providers) < 2:
                logger.warning("Low provider diversity in course recommendations")
            if len(course_levels) < 2:
                logger.warning("Low level diversity in course recommendations")
            
            recommendations["course_recommendations"] = unique_courses

        if "certification_recommendations" in recommendations:
            # Track seen certifications and providers
            seen_certs = set()
            unique_certs = []
            cert_providers = set()
            cert_levels = set()
            
            for cert in recommendations["certification_recommendations"]:
                cert_key = f"{cert['name']}_{cert['provider']}".lower()
                if cert_key not in seen_certs:
                    # Track provider diversity
                    provider = cert["provider"].lower()
                    cert_providers.add(provider)
                    all_providers.append(provider)
                    
                    # Track level diversity
                    if "level" in cert:
                        cert_levels.add(cert["level"].lower())
                    
                    seen_certs.add(cert_key)
                    unique_certs.append(cert)
            
            # Ensure minimum diversity requirements
            if len(unique_certs) < 3:
                logger.warning("Not enough unique certification recommendations")
            if len(cert_providers) < 2:
                logger.warning("Low provider diversity in certification recommendations")
            if len(cert_levels) < 2:
                logger.warning("Low level diversity in certification recommendations")
            
            recommendations["certification_recommendations"] = unique_certs

        # Analyze overall provider diversity
        provider_counts = {}
        for provider in all_providers:
            provider_counts[provider] = provider_counts.get(provider, 0) + 1
        
        # Check for provider overuse
        for provider, count in provider_counts.items():
            if count > 2:  # If same provider used more than twice
                logger.warning(f"Provider '{provider}' appears {count} times across recommendations")

        return recommendations
    except Exception as e:
        logger.error(f"Error validating recommendations: {str(e)}")
        return recommendations

def analyze_text_quality(text):
    """Analyze text quality using ML models"""
    try:
        # Basic metrics
        sentences = text.split('.')
        words = text.split()
        avg_word_length = np.mean([len(word) for word in words])
        
        # Calculate readability score (simplified)
        readability_score = 100 - (avg_word_length * 10)
        
        # Sentiment analysis
        if sentiment_analyzer:
            sentiment_result = sentiment_analyzer(text[:512])[0]  # Limit text length
            sentiment_score = float(sentiment_result['score'])
        else:
            sentiment_score = 0.5  # Neutral sentiment as fallback
        
        return {
            "sentence_count": len(sentences),
            "word_count": len(words),
            "avg_word_length": round(avg_word_length, 2),
            "readability_score": round(readability_score, 2),
            "sentiment_score": round(sentiment_score, 2)
        }
    except Exception as e:
        logger.error(f"Error in text quality analysis: {str(e)}")
        return {
            "sentence_count": 0,
            "word_count": 0,
            "avg_word_length": 0,
            "readability_score": 0,
            "sentiment_score": 0.5
        }

def analyze_skills_match(user_skills, required_skills):
    """Analyze skills match using ML"""
    try:
        if not sentence_model:
            return {"match_percentage": 0, "missing_skills": required_skills}
            
        # Convert skills to embeddings
        user_embeddings = sentence_model.encode(user_skills)
        required_embeddings = sentence_model.encode(required_skills)
        
        # Calculate similarity matrix
        similarity_matrix = cosine_similarity(user_embeddings, required_embeddings)
        
        # Find matches
        matches = []
        missing_skills = []
        
        for i, req_skill in enumerate(required_skills):
            max_similarity = max(similarity_matrix[:, i])
            if max_similarity > 0.5:  # Threshold for considering skills as matched
                matches.append(req_skill)
            else:
                missing_skills.append(req_skill)
        
        match_percentage = (len(matches) / len(required_skills)) * 100
        
        return {
            "match_percentage": round(match_percentage, 2),
            "missing_skills": missing_skills
        }
    except Exception as e:
        logger.error(f"Error in skills match analysis: {str(e)}")
        return {"match_percentage": 0, "missing_skills": required_skills}

def analyze_skills(skills, job_type):
    """Analyze skills relevance and market demand"""
    try:
        if not sentence_model:
            return {
                "relevant_skills": [],
                "market_demand": "Unknown",
                "growth_potential": "Unknown"
            }
            
        # Get job market data
        job_data = JOB_MARKET.get(job_type.lower(), {
            "required_skills": [],
            "market_demand": "Unknown",
            "growth_potential": "Unknown"
        })
        
        # Analyze skills relevance
        relevant_skills = []
        for skill in skills:
            if skill.lower() in [s.lower() for s in job_data["required_skills"]]:
                relevant_skills.append(skill)
        
        return {
            "relevant_skills": relevant_skills,
            "market_demand": job_data["market_demand"],
            "growth_potential": job_data["growth_potential"]
        }
    except Exception as e:
        logger.error(f"Error in skills analysis: {str(e)}")
        return {
            "relevant_skills": [],
            "market_demand": "Unknown",
            "growth_potential": "Unknown"
        }

def get_job_recommendations(skills, job_type):
    """Get job recommendations based on skills and job type"""
    try:
        if not sentence_model:
            return []
            
        recommendations = []
        for job, data in JOB_MARKET.items():
            if job_type.lower() in job.lower():
                match_result = analyze_skills_match(skills, data["required_skills"])
                recommendations.append({
                    "job_title": job,
                    "match_percentage": match_result["match_percentage"],
                    "missing_skills": match_result["missing_skills"],
                    "salary_range": data["salary_range"],
                    "description": data["description"]
                })
        
        # Sort by match percentage
        recommendations.sort(key=lambda x: x["match_percentage"], reverse=True)
        return recommendations[:3]  # Return top 3 recommendations
    except Exception as e:
        logger.error(f"Error in job recommendations: {str(e)}")
        return []

def get_course_recommendations(missing_skills):
    """Get course recommendations for missing skills"""
    try:
        if not sentence_model:
            return []
            
        # Sample course data (in a real application, this would come from a database)
        courses = {
            "Python": ["Python Programming Fundamentals", "Advanced Python Development"],
            "JavaScript": ["JavaScript Basics", "Modern JavaScript Development"],
            "SQL": ["SQL Fundamentals", "Advanced Database Management"],
            "Machine Learning": ["Introduction to Machine Learning", "Deep Learning Fundamentals"],
            "React": ["React Basics", "Advanced React Development"],
            "Node.js": ["Node.js Fundamentals", "Full Stack Development with Node.js"]
        }
        
        recommendations = []
        for skill in missing_skills:
            if skill in courses:
                recommendations.extend(courses[skill])
        
        return list(set(recommendations))  # Remove duplicates
    except Exception as e:
        logger.error(f"Error in course recommendations: {str(e)}")
        return []

def get_fallback_recommendations(job_type, skills):
    """Get fallback recommendations using hardcoded data"""
    try:
        job_data = JOB_MARKET.get(job_type.lower(), {
            "required_skills": [],
            "market_demand": "Unknown",
            "growth_potential": "Unknown"
        })
        
        return {
            "job_recommendations": [{
                "job_title": job_type,
                "match_percentage": 70,
                "salary_range": job_data.get("salary_range", "Unknown"),
                "description": job_data.get("description", "No description available")
            }],
            "course_recommendations": [
                {
                    "title": "Introduction to Programming",
                    "provider": "Coursera",
                    "description": "Basic programming concepts",
                    "level": "Beginner",
                    "link": "https://www.coursera.org"
                }
            ],
            "certification_recommendations": [
                {
                    "title": "Professional Certification",
                    "provider": "Industry Standard",
                    "description": "Professional certification",
                    "level": "Professional",
                    "link": "https://example.com"
                }
            ],
            "market_analysis": {
                "demand": job_data.get("market_demand", "Unknown"),
                "growth_potential": job_data.get("growth_potential", "Unknown"),
                "salary_trends": "Stable"
            }
        }
    except Exception as e:
        logger.error(f"Error in fallback recommendations: {str(e)}")
        return None

def fetch_udemy_courses(query, max_results=5):
    """Fetch course data from Udemy API"""
    try:
        headers = {
            'Authorization': f'Basic {UDEMY_API_KEY}:{UDEMY_CLIENT_ID}',
            'Content-Type': 'application/json'
        }
        
        params = {
            'search': query,
            'page_size': max_results,
            'ordering': 'highest-rated',
            'language': 'en',
            'price': 'price-paid,price-free'
        }
        
        response = requests.get(
            f'{UDEMY_BASE_URL}/courses/',
            headers=headers,
            params=params
        )
        
        if response.status_code == 200:
            data = response.json()
            courses = []
            
            for course in data.get('results', []):
                # Extract course URL
                course_url = course.get('url', '')
                if not course_url:
                    continue
                    
                # Clean up the URL
                course_url = course_url.strip('/')
                if not course_url.startswith('http'):
                    course_url = f"https://www.udemy.com/course/{course_url}"
                
                # Format duration
                duration = course.get('content_info', '')
                if duration:
                    duration = duration.replace(' hours', 'h').replace(' hour', 'h')
                
                courses.append({
                    'title': course.get('title'),
                    'description': course.get('description'),
                    'udemy_link': course_url,
                    'level': course.get('instructional_level', 'All Levels'),
                    'duration': duration,
                    'rating': round(float(course.get('rating', 0)), 1),
                    'price': course.get('price', 'N/A'),
                    'instructor': course.get('visible_instructors', [{}])[0].get('display_name', 'N/A'),
                    'last_updated': course.get('last_update_date', 'N/A'),
                    'language': course.get('locale', {}).get('title', 'English'),
                    'students_count': course.get('num_subscribers', 0),
                    'reviews_count': course.get('num_reviews', 0)
                })
            
            # Remove duplicates based on title
            seen_titles = set()
            unique_courses = []
            for course in courses:
                title = course['title'].lower()
                if title not in seen_titles:
                    seen_titles.add(title)
                    unique_courses.append(course)
            
            return unique_courses
            else:
            logger.error(f"Udemy API error: {response.status_code}")
            return []
            
    except Exception as e:
        logger.error(f"Error fetching Udemy courses: {str(e)}")
        return []

@app.route('/')
def index():
    """Check server status and ML model availability"""
    return jsonify({
        "status": "running",
        "ml_models_loaded": bool(sentence_model and sentiment_analyzer)
    })

@app.route('/analyze', methods=['POST'])
async def analyze_resume():
    """Analyze resume data and provide insights"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Extract data from request
        job_type = data.get('job_type', '')
        skills = data.get('skills', [])
        education = data.get('education', [])
        experience = data.get('experience', [])
        location = data.get('location', '')
        
        # Log input data
        logger.info("=== Processing New Resume ===")
        logger.info(f"Education: {education}")
        logger.info(f"Experience: {experience}")
        logger.info(f"Skills: {', '.join([skill.get('name', '') for skill in skills])}")
        logger.info(f"Target Job Type: {job_type}")
        
        # Get AI recommendations
        recommendations = await get_ai_recommendations(job_type, skills, education, experience, location)
        
        if not recommendations:
            logger.error("Failed to generate recommendations")
            return jsonify({"error": "Failed to generate recommendations"}), 500
        
        # Prepare response
        response = {
            "job_recommendations": recommendations["job_recommendations"],
            "course_recommendations": recommendations["course_recommendations"],
            "certification_recommendations": recommendations["certification_recommendations"],
            "market_analysis": recommendations["market_analysis"]
        }
        
        logger.info("=== Resume Analysis Complete ===")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Error in resume analysis: {str(e)}")
        return jsonify({"error": str(e)}), 500

def calculate_overall_score(text_quality, recommendations):
    """Calculate overall score based on various factors"""
    try:
        # Text quality weight
        text_score = text_quality["readability_score"] * 0.3
        
        # Job match weight (using varied match percentages)
        job_scores = [job["match_percentage"] for job in recommendations["job_recommendations"]]
        if job_scores:
            # Calculate weighted average giving higher weight to better matches
            weighted_scores = [(score, idx) for idx, score in enumerate(sorted(job_scores, reverse=True))]
            weighted_sum = sum(score * (len(job_scores) - idx) for score, idx in weighted_scores)
            total_weights = sum(len(job_scores) - idx for _, idx in weighted_scores)
            job_score = (weighted_sum / total_weights) * 0.4
        else:
            job_score = 0
        
        # Market demand weight (more sophisticated analysis)
        market_analysis = recommendations.get("market_analysis", {})
        market_score = 0
        
        # Consider multiple factors for market score
        if market_analysis.get("current_demand", "").lower() in ["high", "very high"]:
            market_score += 25
        if market_analysis.get("growth_projection", "").lower() in ["strong", "very strong", "positive"]:
            market_score += 25
        if market_analysis.get("salary_trends", "").lower() in ["increasing", "growing", "positive"]:
            market_score += 20
        
        # Calculate final score
        overall_score = text_score + job_score + (market_score * 0.3)
        return round(min(100, max(0, overall_score)), 2)
        
    except Exception as e:
        logger.error(f"Error calculating overall score: {str(e)}")
        return 0

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
