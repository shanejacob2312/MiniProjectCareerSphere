import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "../styles/resumebuilder.css";
import Template1 from "../assets/templates/template1";
import Template2 from "../assets/templates/template2";
import Template3 from "../assets/templates/template3";
import Template4 from "../assets/templates/template4";
import Template5 from "../assets/templates/template5";

const ResumeBuilder = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [resumeData, setResumeData] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("template1");

  useEffect(() => {
    if (location.state?.resumeData) {
      setResumeData(location.state.resumeData);
    } else {
      console.error("No resume data found!");
    }
  }, [location.state]);

  const handleTemplateChange = (template) => {
    setSelectedTemplate(template);
  };

  const handleDownloadPDF = async () => {
    const resumeElement = document.getElementById("resume-preview");

    if (!resumeElement) return;

    const canvas = await html2canvas(resumeElement, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
    pdf.save("Resume.pdf");
  };

  const handleAnalyzeResume = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Format the resume data for analysis
      const analysisData = {
        text: resumeData.summary,
        job_type: resumeData.jobType,
        skills: resumeData.skills.map(skill => ({
          name: skill.name,
          level: skill.level,
          yearsOfExperience: skill.yearsOfExperience
        })),
        education: resumeData.education.map(edu => ({
          degree: edu.degree,
          institution: edu.institution,
          year: edu.year,
          gpa: edu.gpa,
          honors: edu.honors
        })),
        experience: resumeData.experience.map(exp => ({
          title: exp.title,
          company: exp.company,
          duration: exp.duration,
          description: exp.description
        })),
        summary: resumeData.summary,
        location: resumeData.location,
        type: 'created'
      };

      console.log('Sending data for analysis:', analysisData); // Debug log

      // Navigate to AI analysis with the resume data
      navigate("/aianalysis", { 
        state: { 
          resumeData: analysisData
        } 
      });
    } catch (err) {
      console.error('Error preparing resume for analysis:', err);
      alert('Failed to prepare resume for analysis. Please try again.');
    }
  };

  if (!resumeData) {
    return <h2>Loading resume data...</h2>;
  }

  // Calculate education and experience scores
  const calculateEducationScore = (education) => {
    if (!Array.isArray(education)) return 0;
    
    // Define weights for different education levels
    const educationWeights = {
      'PhD': 100,
      'Doctorate': 100,
      'Masters': 80,
      'Master': 80,
      'MBA': 75,
      'Bachelors': 60,
      'Bachelor': 60,
      'BS': 60,
      'BA': 60,
      'Associate': 40,
      'Diploma': 30,
      'Certificate': 20
    };

    // Calculate total score based on education entries
    const totalScore = education.reduce((score, edu) => {
      if (!edu.degree || !edu.institution) return score;
      
      // Find the highest matching education level
      const degree = edu.degree.toLowerCase();
      let maxWeight = 0;
      
      // Check each education level against the degree
      Object.entries(educationWeights).forEach(([level, weight]) => {
        if (degree.includes(level.toLowerCase())) {
          maxWeight = Math.max(maxWeight, weight);
        }
      });

      // If no specific level found, use a default weight
      const weight = maxWeight || 30;
      
      // Add bonus points for additional details
      let bonus = 0;
      if (edu.graduationYear) bonus += 5;
      if (edu.gpa) bonus += 5;
      if (edu.honors) bonus += 5;
      
      return score + Math.min(100, weight + bonus);
    }, 0);

    // Normalize the score to be between 0 and 100
    return Math.min(100, totalScore / education.length);
  };

  const calculateExperienceScore = (experience) => {
    if (!Array.isArray(experience)) return 0;

    // Define position level weights
    const positionWeights = {
      'CEO': 100,
      'CTO': 95,
      'Director': 90,
      'Manager': 80,
      'Lead': 75,
      'Senior': 70,
      'Principal': 65,
      'Staff': 60,
      'Associate': 50,
      'Junior': 40,
      'Intern': 20
    };

    // Calculate total score based on experience entries
    const totalScore = experience.reduce((score, exp) => {
      if (!exp.title || !exp.company) return score;

      // Base score for having title and company
      let positionScore = 30;

      // Calculate position level score
      const title = exp.title.toLowerCase();
      let maxPositionWeight = 0;
      Object.entries(positionWeights).forEach(([level, weight]) => {
        if (title.includes(level.toLowerCase())) {
          maxPositionWeight = Math.max(maxPositionWeight, weight);
        }
      });
      positionScore += maxPositionWeight || 30;

      // Calculate tenure score
      let tenureScore = 0;
      if (exp.duration) {
        const years = calculateYearsFromDuration(exp.duration);
        tenureScore = Math.min(20, years * 2); // 2 points per year, max 20
      }

      // Calculate relevance score based on description
      let relevanceScore = 0;
      if (exp.description) {
        const description = exp.description.toLowerCase();
        // Check for relevant keywords in description
        const relevantKeywords = ['lead', 'manage', 'develop', 'implement', 'design', 'create', 'analyze', 'optimize'];
        const keywordCount = relevantKeywords.filter(keyword => description.includes(keyword)).length;
        relevanceScore = Math.min(20, keywordCount * 2); // 2 points per keyword, max 20
      }

      // Add bonus points for additional details
      let bonus = 0;
      if (exp.description && exp.description.length > 100) bonus += 5;
      if (exp.duration && exp.duration.includes('-')) bonus += 5;

      return score + Math.min(100, positionScore + tenureScore + relevanceScore + bonus);
    }, 0);

    // Normalize the score to be between 0 and 100
    return Math.min(100, totalScore / experience.length);
  };

  // Helper function to calculate years from duration string
  const calculateYearsFromDuration = (duration) => {
    try {
      // Handle different duration formats
      const yearsMatch = duration.match(/(\d+)\s*(?:year|yr)/i);
      if (yearsMatch) return parseInt(yearsMatch[1]);

      // Handle date range format (e.g., "2020-2022")
      const dateRange = duration.split('-').map(year => parseInt(year.trim()));
      if (dateRange.length === 2 && !isNaN(dateRange[0]) && !isNaN(dateRange[1])) {
        return dateRange[1] - dateRange[0];
      }

      // Handle "Present" in date range
      const presentMatch = duration.match(/(\d{4})\s*-\s*Present/i);
      if (presentMatch) {
        const startYear = parseInt(presentMatch[1]);
        const currentYear = new Date().getFullYear();
        return currentYear - startYear;
      }

      return 0;
    } catch (error) {
      console.error('Error calculating years from duration:', error);
      return 0;
    }
  };

  // Transform the data for Template4 and Template5
  const transformedData = {
    fullName: resumeData.name,
    email: resumeData.email,
    phone: resumeData.phone,
    location: resumeData.location,
    website: resumeData.website || '',
    jobTitle: resumeData.jobType,
    professionalSummary: resumeData.summary,
    skills: resumeData.skills || [],
    experience: resumeData.experience || [],
    education: resumeData.education || [],
    educationScore: calculateEducationScore(resumeData.education),
    experienceScore: calculateExperienceScore(resumeData.experience),
    text_quality: {
      education_score: calculateEducationScore(resumeData.education),
      experience_score: calculateExperienceScore(resumeData.experience)
    }
  };

  return (
    <div className="resume-builder-container">
      <h1>Preview & Customize Your Resume</h1>

      <div className="template-selection">
        <button 
          onClick={() => handleTemplateChange("template1")}
          className={selectedTemplate === "template1" ? "active" : ""}
        >
          Classic
        </button>
        <button 
          onClick={() => handleTemplateChange("template2")}
          className={selectedTemplate === "template2" ? "active" : ""}
        >
          Professional
        </button>
        <button 
          onClick={() => handleTemplateChange("template3")}
          className={selectedTemplate === "template3" ? "active" : ""}
        >
          Modern
        </button>
        <button 
          onClick={() => handleTemplateChange("template4")}
          className={selectedTemplate === "template4" ? "active" : ""}
        >
          Corporate
        </button>
        <button 
          onClick={() => handleTemplateChange("template5")}
          className={selectedTemplate === "template5" ? "active" : ""}
        >
          Creative
        </button>
      </div>

      <div id="resume-preview" className="resume-preview">
        {selectedTemplate === "template1" && <Template1 data={resumeData} />}
        {selectedTemplate === "template2" && <Template2 data={resumeData} />}
        {selectedTemplate === "template3" && <Template3 data={resumeData} />}
        {selectedTemplate === "template4" && <Template4 formData={transformedData} />}
        {selectedTemplate === "template5" && <Template5 formData={transformedData} />}
      </div>

      <div className="resume-buttons">
        <button onClick={handleDownloadPDF} className="download-button">
          Download as PDF
        </button>
        <button 
          onClick={handleAnalyzeResume} 
          className="ai-analysis-button"
        >
          Analyze with AI
        </button>
      </div>
    </div>
  );
};

export default ResumeBuilder;
