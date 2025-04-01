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

async def get_ai_recommendations(job_type, skills, education, experience):
    """Get AI-generated recommendations using HuggingFace API"""
    try:
        headers = {
            "Authorization": f"Bearer {os.getenv('HUGGINGFACE_API_KEY')}",
            "Content-Type": "application/json"
        }
        
        # Prepare the prompt for comprehensive analysis
        prompt = f"""Analyze this professional profile in detail and provide tailored career recommendations:

PROFILE ANALYSIS:
1. Education Details:
- Degree/Certification: {education}
- Analyze level (Bachelor's, Master's, PhD, etc.)
- Identify field of study and specializations
- Consider academic achievements and relevance

2. Experience Analysis:
- Current/Past Roles: {experience}
- Analyze experience level and progression
- Identify industry exposure and domain expertise
- Evaluate leadership and project experience

3. Skills Assessment:
- Core Skills: {', '.join(skills)}
- Analyze skill relevance and proficiency
- Identify skill gaps and growth areas
- Map skills to current market demands

4. Career Direction:
- Current/Target Role: {job_type}
- Analyze career trajectory
- Identify potential growth paths
- Consider industry transitions

Based on this comprehensive analysis, provide these recommendations:

1. Career Paths (5-7 recommendations):
- Match roles to their exact education and experience level
- Consider both vertical and lateral career moves
- Include emerging roles in their field
- Provide detailed rationale for each match
- Calculate match scores based on:
  * Education alignment (25%)
  * Experience relevance (35%)
  * Skills match (30%)
  * Industry fit (10%)

2. Professional Development:
- Courses that directly enhance their current qualifications
- Learning paths aligned with their career trajectory
- Skill development opportunities based on gaps
- Programs matching their education level
- Clear progression path for each recommendation

3. Professional Certifications:
- Credentials matching their education level
- Industry-recognized certifications in their field
- Certifications that complement their experience
- Clear value proposition for each certification
- Realistic preparation requirements

4. Market Analysis:
- Detailed industry trends in their field
- Growth areas matching their profile
- Skill demand analysis
- Career path projections
- Salary trends based on their qualifications

Format as JSON with detailed rationale for each recommendation.

ANALYSIS REQUIREMENTS:
1. Evaluate exact degree relevance for each recommendation
2. Consider experience depth and breadth
3. Analyze skill transferability
4. Assess industry alignment
5. Calculate realistic growth potential
6. Provide evidence-based matches"""

        # Call HuggingFace API
        response = requests.post(
            "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
            headers=headers,
            json={
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 2000,
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "return_full_text": False
                }
            }
        )

        if response.status_code == 200:
            try:
                # Parse the AI response
                ai_response = response.json()
                if isinstance(ai_response, list) and len(ai_response) > 0:
                    # Extract the generated text
                    generated_text = ai_response[0].get('generated_text', '')
                    # Parse the JSON response
                    recommendations = json.loads(generated_text)
                    
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
                logger.info(f"\nRole: {job['job_title']}")
                logger.info(f"Match: {job['match_percentage']}%")
                logger.info(f"Industry: {job['industry']}")
                logger.info("Required Skills Match: " + 
                          str(len(set(skills) & set(job['required_skills']))) + 
                          f" out of {len(job['required_skills'])}")
                
        # Course Recommendations Analysis
        if "course_recommendations" in recommendations:
            logger.info("\nCourse Recommendations Analysis:")
            for course in recommendations["course_recommendations"]:
                logger.info(f"\nCourse: {course['title']}")
                logger.info(f"Provider: {course['provider']}")
                logger.info(f"Level: {course['level']}")
                logger.info(f"Relevance: Maps to {len(set(skills) & set(course['topics']))} current skills")
                
        # Certification Recommendations Analysis
        if "certification_recommendations" in recommendations:
            logger.info("\nCertification Recommendations Analysis:")
            for cert in recommendations["certification_recommendations"]:
                logger.info(f"\nCertification: {cert['title']}")
                logger.info(f"Provider: {cert['provider']}")
                logger.info(f"Level: {cert['level']}")
                logger.info(f"Prerequisites Match: {all(skill in skills for skill in cert['prerequisites']['required_skills'])}")
                
        # Market Analysis
        if "market_analysis" in recommendations:
            logger.info("\nMarket Analysis:")
            logger.info(f"Current Demand: {recommendations['market_analysis']['current_demand']}")
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
                job_key = job["job_title"].lower()
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
                    if "industry" in job:
                        industries.add(job["industry"].lower())
                    
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
                course_key = f"{course['title']}_{course['provider']}".lower()
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
                cert_key = f"{cert['title']}_{cert['provider']}".lower()
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
        education = data.get('education', '')
        experience = data.get('experience', '')
        
        # Log input data
        logger.info("=== Processing New Resume ===")
        logger.info(f"Education: {education}")
        logger.info(f"Experience: {experience}")
        logger.info(f"Skills: {', '.join(skills)}")
        logger.info(f"Target Job Type: {job_type}")
        
        # Get AI recommendations
        recommendations = await get_ai_recommendations(job_type, skills, education, experience)
        
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
