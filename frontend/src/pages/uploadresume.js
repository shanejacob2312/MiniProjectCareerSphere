import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/uploadresume.css";

const UploadResume = () => {
  const navigate = useNavigate();
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfFileObject, setPdfFileObject] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jobType, setJobType] = useState("");

  // Helper function to extract education details
  const extractEducation = (text) => {
    console.log('Starting education extraction from text');
    
    // Find the education section using a more flexible regex
    const educationMatch = text.match(/Education[\s\S]*?(?=Skills|Experience|Summary|$)/i);
    
    if (!educationMatch) {
      console.log('No education section found');
      return [];
    }

    const educationSection = educationMatch[0];
    console.log('Found education section:', educationSection);

    // Split into lines and process
    const lines = educationSection.split('\n').map(line => line.trim()).filter(line => line);
    console.log('Processing education lines:', lines);

    const education = [];
    let currentEntry = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip the "Education" header
      if (line.toLowerCase() === 'education') continue;

      // Check for degree and institution pattern: "Degree - Institution (Year)"
      const degreeMatch = line.match(/(.+?)\s*-\s*(.+?)\s*\((\d{4})\)/);
      if (degreeMatch) {
        const [_, degree, institution, year] = degreeMatch;
        education.push({
          institution: institution.trim(),
          degree: degree.trim(),
          year: year
        });
        continue;
      }

      // If no match found, try to create an entry with just the line
      if (!currentEntry) {
        currentEntry = {
          institution: line,
          degree: '',
          year: ''
        };
      }
    }

    // Add the last entry if exists
    if (currentEntry) {
      education.push(currentEntry);
    }

    console.log('Final education array:', education);
    return education;
  };

  // Helper function to extract experience details
  const extractExperience = (text) => {
    const experienceSection = text.match(/EXPERIENCE(.*?)(?=PROJECTS|EDUCATION|SKILLS|$)/s);
    if (!experienceSection) return [];

    const experience = [];
    const lines = experienceSection[1].split('\n').filter(line => line.trim());
    
    let currentEntry = {};
    for (let line of lines) {
      if (line.includes('|')) {
        if (Object.keys(currentEntry).length > 0) {
          experience.push(currentEntry);
        }
        const [title, role] = line.split('|').map(s => s.trim());
        currentEntry = {
          company: title,
          title: role,
          duration: '',
          description: []
        };
      } else if (line.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i)) {
        currentEntry.duration = line.trim();
      } else if (line.startsWith('•')) {
        currentEntry.description.push(line.trim());
      }
    }
    if (Object.keys(currentEntry).length > 0) {
      experience.push(currentEntry);
    }
    return experience;
  };

  // Helper function to extract skills
  const extractSkills = (text) => {
    const skillsSection = text.match(/Skills[\s\S]*?(?=Summary|Experience|Education|$)/i);
    if (!skillsSection) return [];

    const skillsText = skillsSection[0];
    console.log('Found skills section:', skillsText);

    // Remove the "Skills" header and split by commas
    const skills = skillsText
      .replace(/^Skills\s*/i, '') // Remove "Skills" header
      .split(',')
      .map(skill => skill.trim())
      .filter(skill => 
        skill.length > 1 && 
        !skill.includes('=') &&
        !skill.match(/^\d+$/) &&
        !['skills', 'skill'].includes(skill.toLowerCase())
      );
    
    console.log('Extracted skills:', skills);
    return Array.from(new Set(skills)); // Remove duplicates
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(URL.createObjectURL(file));
      setPdfFileObject(file);
      setError(null);
      setIsLoading(true);
      
      // Extract text from PDF
      const formData = new FormData();
      formData.append("resume", file);

      try {
        const response = await fetch("http://localhost:5000/api/resumeanalysis/extracttext", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to extract text from PDF");
        }

        const data = await response.json();
        if (!data.text || data.text.trim() === '') {
          throw new Error("No text could be extracted from the PDF");
        }
        setExtractedText(data.text);
      } catch (error) {
        console.error("Error extracting text:", error);
        setError(error.message || "Failed to extract text from PDF. Please try again.");
        setExtractedText(""); // Clear any partial text
      } finally {
        setIsLoading(false);
      }
    } else {
      setError("Please upload a PDF file.");
      setPdfFile(null);
      setPdfFileObject(null);
      setExtractedText("");
    }
  };

  const handleAnalyzeResume = async () => {
    if (!pdfFileObject) {
      setError("Please upload a resume before analyzing.");
      return;
    }

    if (!extractedText || extractedText.trim() === '') {
      setError("Failed to extract text from the resume. Please try uploading again.");
      return;
    }

    if (!jobType.trim()) {
      setError("Please specify the job type you're looking for.");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Clean up the extracted text
      const cleanedText = extractedText
        .replace(/\r\n/g, '\n')  // Normalize line endings
        .replace(/\n\s+/g, '\n') // Remove leading whitespace
        .trim();

      console.log('Cleaned text for extraction:', cleanedText);

      // Extract structured data from the text
      const skills = extractSkills(cleanedText);
      const education = extractEducation(cleanedText);
      const experience = extractExperience(cleanedText);

      console.log('Extracted education data:', education);
      console.log('Extracted experience data:', experience);
      console.log('Extracted skills data:', skills);

      // Format the resume data for analysis
      const resumeData = {
        text: cleanedText,
        job_type: jobType.trim(),
        skills: skills.map(skill => ({
          name: skill,
          level: 'Intermediate',  // Default level for uploaded resumes
          yearsOfExperience: 0    // Default years for uploaded resumes
        })),
        education: education.map(edu => ({
          degree: edu.degree || '',
          institution: edu.institution || '',
          year: edu.year || '',
          gpa: edu.gpa || '',
          honors: edu.honors || ''
        })),
        experience: experience.map(exp => ({
          title: exp.title || '',
          company: exp.company || '',
          duration: exp.duration || '',
          description: exp.description || ''
        })),
        summary: cleanedText.substring(0, 500), // First 500 characters as summary
        type: 'uploaded',
        // Add structure analysis data
        structure_score: 0,  // Will be calculated by backend
        formatting: {
          hasHeaders: cleanedText.match(/^[A-Z\s]+:/gm) !== null,
          hasBulletPoints: cleanedText.includes('•'),
          hasProperSpacing: cleanedText.match(/\n\s*\n/) !== null
        },
        parsed_sections: {
          hasEducation: education.length > 0,
          hasExperience: experience.length > 0,
          hasSkills: skills.length > 0,
          sectionCount: [
            education.length > 0,
            experience.length > 0,
            skills.length > 0
          ].filter(Boolean).length
        }
      };

      console.log('Final resume data being sent:', resumeData);

      // Navigate to AI analysis with the resume data
      navigate("/aianalysis", { state: { resumeData } });
    } catch (err) {
      console.error('Error preparing resume for analysis:', err);
      setError('Failed to prepare resume for analysis. Please try again.');
    }
  };

  return (
    <div className="upload-resume-container">
      <div className="button-section">
        <label htmlFor="upload-resume" className="upload-button">
          Upload Resume
        </label>
        <input
          id="upload-resume"
          type="file"
          accept="application/pdf"
          onChange={handleFileUpload}
          hidden
        />
        <div className="job-type-input">
          <input
            type="text"
            placeholder="Enter desired job type (e.g., Software Developer, Data Scientist)"
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="job-type-field"
          />
        </div>
        <button 
          className="analyze-button" 
          onClick={handleAnalyzeResume}
          disabled={isLoading || !extractedText || !jobType.trim()}
        >
          {isLoading ? 'Processing...' : 'Analyze Resume'}
        </button>
        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="pdf-preview">
        {pdfFile ? (
          <embed src={pdfFile} type="application/pdf" className="pdf-viewer" />
        ) : (
          <p className="placeholder-text">Upload a resume to preview.</p>
        )}
      </div>
    </div>
  );
};

export default UploadResume;
