import React, { useState } from "react";
import "../styles/createresume.css";

const CreateResume = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    skills: "",
    selectedTemplate: "None",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectTemplate = (template) => {
    setFormData({ ...formData, selectedTemplate: template });
  };

  return (
    <div className="page-container">
      <div className="resume-container">
        {/* Resume Form Section */}
        <div className="resume-form">
          <h2>Create Your Resume</h2>
          <input
            type="text"
            name="fullName"
            placeholder="Full Name"
            value={formData.fullName}
            onChange={handleChange}
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
          />
          <input
            type="text"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
          />
          <textarea
            name="skills"
            placeholder="Skills"
            value={formData.skills}
            onChange={handleChange}
          ></textarea>

          {/* Template Selection */}
          <div className="template-selection">
            <button onClick={() => selectTemplate("Template 1")}>
              Template 1
            </button>
            <button onClick={() => selectTemplate("Template 2")}>
              Template 2
            </button>
          </div>

          {/* Generate Resume Button */}
          <button className="generate-resume-btn">Generate Resume</button>
        </div>

        {/* Resume Preview Section */}
        <div className="resume-preview">
          <h2>Preview</h2>
          <p>
            Selected Template: <span>{formData.selectedTemplate}</span>
          </p>
          <p>Name: {formData.fullName}</p>
          <p>Email: {formData.email}</p>
          <p>Phone: {formData.phone}</p>
          <p>Skills: {formData.skills}</p>
        </div>
      </div>
    </div>
  );
};

export default CreateResume;
