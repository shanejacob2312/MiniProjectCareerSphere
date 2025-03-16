import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import for navigation
import "../styles/resumeinput.css";

const ResumeInput = () => {
  const navigate = useNavigate(); // Hook for navigation

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    location: "",
    gender: "",
    phone: "",
    email: "",
    education: [{ degree: "", institution: "", year: "" }],
    skills: [""],
    summary: "",
    jobType: "", // New field for job type
  });

  const handleChange = (e, index = null, field = null) => {
    const { name, value } = e.target;
    if (index !== null && field) {
      const updatedArray = [...formData[name]];
      updatedArray[index][field] = value;
      setFormData({ ...formData, [name]: updatedArray });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const addEducation = () => {
    setFormData({
      ...formData,
      education: [...formData.education, { degree: "", institution: "", year: "" }],
    });
  };

  const addSkill = () => {
    setFormData({
      ...formData,
      skills: [...formData.skills, ""],
    });
  };

  const handleAIgenerate = () => {
    // Placeholder for AI-generated summary logic
    const generatedSummary = `A highly motivated individual with expertise in ${formData.skills.join(
      ", "
    )} and a background in ${formData.education
      .map((edu) => edu.degree)
      .join(", ")} from ${formData.education
      .map((edu) => edu.institution)
      .join(", ")}.`;
    setFormData({ ...formData, summary: generatedSummary });
  };

  const handleCreateResume = () => {
    navigate("/resumebuilder", { state: { resumeData: formData } });
  };

  return (
    <div className="resume-input-container">
      <h1>Create Your Resume</h1>
      <form>
        <div className="input-group">
          <label>Job Type:</label>
          <input
            type="text"
            name="jobType"
            value={formData.jobType}
            onChange={handleChange}
            required
          />
        </div>
        <div className="input-group">
          <label>Name:</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </div>

        <div className="input-group">
          <label>Age:</label>
          <input type="number" name="age" value={formData.age} onChange={handleChange} required />
        </div>

        <div className="input-group">
          <label>Location:</label>
          <input type="text" name="location" value={formData.location} onChange={handleChange} required />
        </div>

        <div className="input-group">
          <label>Gender:</label>
          <select name="gender" value={formData.gender} onChange={handleChange} required>
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="input-group">
          <label>Phone Number:</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} required />
        </div>

        <div className="input-group">
          <label>Email ID:</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required />
        </div>

        <h2>Education</h2>
        {formData.education.map((edu, index) => (
          <div key={index} className="education-entry">
            <input
              type="text"
              name="education"
              placeholder="Degree"
              value={edu.degree}
              onChange={(e) => handleChange(e, index, "degree")}
              required
            />
            <input
              type="text"
              name="education"
              placeholder="Institution"
              value={edu.institution}
              onChange={(e) => handleChange(e, index, "institution")}
              required
            />
            <input
              type="text"
              name="education"
              placeholder="Year"
              value={edu.year}
              onChange={(e) => handleChange(e, index, "year")}
              required
            />
          </div>
        ))}
        <button type="button" onClick={addEducation} className="add-button">+ Add Education</button>

        <h2>Skills</h2>
        {formData.skills.map((skill, index) => (
          <div key={index} className="skill-entry">
            <input
              type="text"
              name="skills"
              placeholder="Skill"
              value={skill}
              onChange={(e) => {
                const updatedSkills = [...formData.skills];
                updatedSkills[index] = e.target.value;
                setFormData({ ...formData, skills: updatedSkills });
              }}
              required
            />
          </div>
        ))}
        <button type="button" onClick={addSkill} className="add-button">+ Add Skill</button>

        <h2>Summary</h2>
        <textarea
          name="summary"
          placeholder="Write a brief summary..."
          value={formData.summary}
          onChange={handleChange}
          required
        />
        <button type="button" onClick={handleAIgenerate} className="ai-generate-button">
          Generate with AI
        </button>

        {/* New Create Resume Button */}
        <button type="button" onClick={handleCreateResume} className="create-resume-button">
          Create Resume
        </button>

      </form>
    </div>
  );
};

export default ResumeInput;
