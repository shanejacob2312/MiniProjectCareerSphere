import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/uploadresume.css";

const UploadResume = () => {
  const navigate = useNavigate();
  const [pdfFile, setPdfFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];

    if (file && file.type === "application/pdf") {
      const fileURL = URL.createObjectURL(file);
      setPdfFile(fileURL);

      // Send the file to the backend for text extraction
      await uploadToBackend(file);
    } else {
      alert("Please upload a valid PDF file.");
    }
  };

  const uploadToBackend = async (file) => {
    const formData = new FormData();
    formData.append("resume", file);

    try {
      const response = await axios.post("http://localhost:5000/api/extracttext", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setExtractedText(response.data.text); // Store extracted text from backend
    } catch (error) {
      console.error("Error extracting text:", error);
      alert("Failed to extract text from the resume.");
    }
  };

  const handleAnalyzeResume = () => {
    if (!pdfFile) {
      alert("Please upload a resume before analyzing.");
      return;
    }

    navigate("/aianalysis", { state: { pdfFile, pdfText: extractedText } });
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
        <button className="analyze-button" onClick={handleAnalyzeResume}>
          Analyze Resume
        </button>
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
