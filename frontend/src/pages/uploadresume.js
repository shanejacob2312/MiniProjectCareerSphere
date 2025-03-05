import React, { useState } from "react";
import "../styles/uploadresume.css";

const UploadResume = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewURL, setPreviewURL] = useState("");

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewURL(URL.createObjectURL(file));
        }
    };

    return (
        <div className="upload-container">
            {/* Left Side - Upload Section */}
            <div className="upload-section">
                <h2>Upload Your Resume</h2>
                <div className="upload-box">
                    <input type="file" accept=".pdf" onChange={handleFileChange} />
                </div>
                <button className="grade-button">Grade Resume</button>
            </div>

            {/* Right Side - Resume Preview */}
            <div className="preview-section">
                {previewURL ? (
                    <embed src={previewURL} type="application/pdf" className="resume-preview" />
                ) : (
                    <div className="placeholder-text">Your resume preview will appear here</div>
                )}
            </div>
        </div>
    );
};

export default UploadResume;
