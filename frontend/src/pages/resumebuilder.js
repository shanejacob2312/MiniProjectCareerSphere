import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "../styles/resumebuilder.css";
import Template1 from "../assets/templates/template1";
import Template2 from "../assets/templates/template2";

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

  const handleAnalyzeResume = () => {
    if (!resumeData) {
      alert("No resume data available for analysis.");
      return;
    }
    navigate("/aianalysis", { state: { resume: selectedTemplate } });
  };

  if (!resumeData) {
    return <h2>Loading resume data...</h2>;
  }

  return (
    <div className="resume-builder-container">
      <h1>Preview & Customize Your Resume</h1>

      <div className="template-selection">
        <button onClick={() => handleTemplateChange("template1")}>
          Template 1
        </button>
        <button onClick={() => handleTemplateChange("template2")}>
          Template 2
        </button>
      </div>

      <div id="resume-preview" className="resume-preview">
        {selectedTemplate === "template1" ? (
          <Template1 data={resumeData} />
        ) : (
          <Template2 data={resumeData} />
        )}
      </div>

      <div className="resume-buttons">
        <button onClick={handleDownloadPDF} className="download-button">
          Download as PDF
        </button>
        <button 
        onClick={() => navigate("/aianalysis", { state: { resumeData } })} 
        className="ai-analysis-button"
        >
          Analyze with AI
        </button>

      </div>
    </div>
  );
};

export default ResumeBuilder;
