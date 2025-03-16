import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import "../styles/aianalysis.css";

const AIAnalysis = () => {
  const location = useLocation();
  const [resumeText, setResumeText] = useState(""); // Store extracted text
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const analysisRef = useRef(null);

  // Fetch resume text from backend or localStorage
  useEffect(() => {
    const fetchResumeText = async (fileUrl) => {
      try {
        const response = await fetch("http://localhost:5000/api/resume/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl }),
        });

        const data = await response.json();
        if (data.text) {
          setResumeText(data.text);
          localStorage.setItem("resumeText", JSON.stringify(data.text));
        } else {
          throw new Error("Failed to extract text.");
        }
      } catch (error) {
        console.error("Error extracting resume text:", error);
        alert("Failed to extract text from resume.");
      }
    };

    const resumeFile = location.state?.resume;
    if (resumeFile) {
      fetchResumeText(resumeFile);
    } else {
      const storedResume = localStorage.getItem("resumeText");
      if (storedResume) setResumeText(JSON.parse(storedResume));
    }
  }, [location]);

  // Scroll to analysis section
  const handleAnalyze = async () => {
    if (!resumeText) {
      alert("No resume text found. Please upload or create a resume.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: resumeText }),
      });

      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error("Error analyzing resume:", error);
      alert("Failed to analyze resume. Please try again.");
    }

    setLoading(false);
    analysisRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="aianalysis-container">
      <h1>AI Resume Analysis</h1>

      {/* Resume Preview */}
      <div className="resume-preview">
        {resumeText ? (
          <pre className="resume-text">{resumeText}</pre>
        ) : (
          <p>No resume found. Please upload or create a resume first.</p>
        )}
      </div>

      {/* Analyze Button */}
      <button className="analyze-btn" onClick={handleAnalyze} disabled={loading}>
        {loading ? "Analyzing..." : "Analyze Resume"}
      </button>

      {/* Analysis Results */}
      {analysis && (
        <div ref={analysisRef} className="analysis-sections">
          <div className="section">
            <h2>Resume Grade</h2>
            <p>🔢 Score: <span className="score">{analysis.grade}/10</span></p>
          </div>

          <div className="section">
            <h2>✅ Positives</h2>
            <ul>
              {analysis.positives?.map((point, index) => (
                <li key={index}>{point}</li>
              )) || <p>No positives detected.</p>}
            </ul>
          </div>

          <div className="section">
            <h2>❌ Negatives</h2>
            <ul>
              {analysis.negatives?.map((point, index) => (
                <li key={index}>{point}</li>
              )) || <p>No negatives detected.</p>}
            </ul>
          </div>

          <div className="section">
            <h2>📌 Ways to Improve</h2>
            <ul>
              {analysis.improvements?.map((point, index) => (
                <li key={index}>{point}</li>
              )) || <p>No improvements suggested.</p>}
            </ul>
          </div>

          <div className="section">
            <h2>🎓 Suggested Courses</h2>
            <ul>
              {analysis.suggestedCourses?.map((course, index) => (
                <li key={index}>
                  <a href={course.link} target="_blank" rel="noopener noreferrer">{course.title}</a>
                </li>
              )) || <p>No courses suggested.</p>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAnalysis;
