from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
from transformers import pipeline
from pdfminer.high_level import extract_text
import os

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

# Load BERT Model for Text Classification
print("Loading BERT model...")
bert_analyzer = pipeline("text-classification", model="nlptown/bert-base-multilingual-uncased-sentiment")

# Function to extract text from PDF
def extract_resume_text(pdf_path):
    try:
        return extract_text(pdf_path)
    except Exception as e:
        return str(e)

@app.route("/", methods=["GET"])
def home():
    return "BERT AI API is running!"

@app.route("/analyze", methods=["POST"])
def analyze_resume():
    if "resume" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    resume_file = request.files["resume"]
    temp_path = "temp_resume.pdf"
    
    # Save the file temporarily
    resume_file.save(temp_path)

    # Extract text
    resume_text = extract_resume_text(temp_path)
    os.remove(temp_path)  # Clean up

    if not resume_text.strip():
        return jsonify({"error": "Could not extract text from resume"}), 400

    # Analyze resume text with BERT
    analysis_result = bert_analyzer(resume_text[:512])  # Limiting text length for BERT processing

    # Convert output to structured data
    score = round((analysis_result[0]['score'] * 10), 1)  # Scale from 1-10
    label = analysis_result[0]['label']

    response = {
        "grade": f"{score}/10",
        "positives": ["Well-structured format", "Relevant skills included"],
        "negatives": ["Needs more quantifiable achievements", "Work experience section can be improved"],
        "improvements": ["Use stronger action verbs", "Add measurable accomplishments"],
        "courses": [
            {"title": "Professional Resume Writing", "url": "https://www.coursera.org/specializations/resume-writing"},
            {"title": "Effective Resume Writing", "url": "https://www.udemy.com/course/effective-resume-writing"}
        ],
        "bert_label": label  # Debugging info
    }
    
    return jsonify(response)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
