import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import for navigation
import "../styles/resumeinput.css";

const ResumeInput = () => {
  const navigate = useNavigate(); // Hook for navigation
  const [showExperience, setShowExperience] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    location: "",
    gender: "",
    phone: "",
    email: "",
    education: [{ degree: "", institution: "", year: "", gpa: "", honors: "" }],
    experience: [],
    skills: [{ name: "", level: "Beginner", yearsOfExperience: 0 }],
    summary: "",
    jobType: "", // New field for job type
  });

  const handleChange = (e, index = null, field = null) => {
    const { name, value } = e.target;
    
    if (index !== null && field) {
      // Handle array fields (education, experience)
      const arrayField = name === 'education' ? 'education' : 
                        name === 'experience' ? 'experience' : null;
                        
      if (arrayField) {
        const updatedArray = [...formData[arrayField]];
        updatedArray[index] = {
          ...updatedArray[index],
          [field]: value
        };
        setFormData({ ...formData, [arrayField]: updatedArray });
      }
    } else {
      // Handle regular fields
      setFormData({ ...formData, [name]: value });
    }
  };

  const addEducation = () => {
    setFormData({
      ...formData,
      education: [...formData.education, { degree: "", institution: "", year: "", gpa: "", honors: "" }],
    });
  };

  const addExperience = () => {
    setFormData({
      ...formData,
      experience: [...formData.experience, { title: "", company: "", duration: "", description: "" }],
    });
  };

  const addSkill = () => {
    setFormData({
      ...formData,
      skills: [...formData.skills, { name: "", level: "Beginner", yearsOfExperience: 0 }],
    });
  };

  const handleSkillChange = (index, field, value) => {
    const updatedSkills = [...formData.skills];
    updatedSkills[index] = {
      ...updatedSkills[index],
      [field]: value
    };
    setFormData({ ...formData, skills: updatedSkills });
  };

  const handleCreateResume = async () => {
    // Validate required fields
    if (!formData.name || !formData.jobType || !formData.skills.length) {
      alert("Please fill in all required fields (Name, Job Type, and at least one skill)");
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Format the resume data with all form fields
      const resumeData = {
        text: `
          Name: ${formData.name}
          Job Type: ${formData.jobType}
          Age: ${formData.age || 'N/A'}
          Location: ${formData.location || 'N/A'}
          Gender: ${formData.gender || 'N/A'}
          Phone: ${formData.phone || 'N/A'}
          Email: ${formData.email || 'N/A'}

          Summary:
          ${formData.summary || 'N/A'}

          Education:
          ${formData.education.map(edu => 
            `${edu.degree} from ${edu.institution} (${edu.year})
             GPA: ${edu.gpa || 'N/A'}
             Honors: ${edu.honors || 'N/A'}`
          ).join('\n')}

          Experience:
          ${formData.experience.map(exp => 
            `${exp.title} at ${exp.company}
             Duration: ${exp.duration || 'N/A'}
             ${exp.description || ''}`
          ).join('\n\n')}

          Skills:
          ${formData.skills.map(skill => 
            `${skill.name} (${skill.level}, ${skill.yearsOfExperience} years)`
          ).join(', ')}
        `,
        name: formData.name,
        age: formData.age || '',
        location: formData.location || '',
        gender: formData.gender || '',
        phone: formData.phone || '',
        email: formData.email || '',
        job_type: formData.jobType,
        skills: formData.skills.filter(skill => skill.name.trim() !== ''),
        education: formData.education
          .filter(edu => edu.degree && edu.institution)
          .map(edu => ({
            degree: edu.degree,
            institution: edu.institution,
            year: edu.year || '',
            gpa: edu.gpa || '',
            honors: edu.honors || ''
          })),
        experience: formData.experience
          .filter(exp => exp.title && exp.company)
          .map(exp => ({
            title: exp.title,
            company: exp.company,
            duration: exp.duration || '',
            description: exp.description || ''
          })),
        summary: formData.summary || '',
        type: 'created'
      };

      console.log('Sending resume data:', resumeData);

      // Navigate to AI analysis with the resume data
      navigate("/aianalysis", { 
        state: { 
          resumeData: resumeData
        } 
      });
    } catch (err) {
      console.error('Error preparing resume for analysis:', err);
      alert('Failed to prepare resume for analysis. Please try again.');
    }
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

        <h2>Skills</h2>
        {formData.skills.map((skill, index) => (
          <div key={index} className="skill-entry">
            <input
              type="text"
              placeholder="Skill name"
              value={skill.name}
              onChange={(e) => handleSkillChange(index, "name", e.target.value)}
              required
            />
            <select
              value={skill.level}
              onChange={(e) => handleSkillChange(index, "level", e.target.value)}
              required
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
              <option value="Master">Master</option>
            </select>
            <input
              type="number"
              placeholder="Years of experience"
              value={skill.yearsOfExperience}
              onChange={(e) => handleSkillChange(index, "yearsOfExperience", parseInt(e.target.value) || 0)}
              min="0"
              required
            />
          </div>
        ))}
        <button type="button" onClick={addSkill} className="add-button">
          Add Skill
        </button>

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
              placeholder="Year (e.g., 2022-2026)"
              value={edu.year}
              onChange={(e) => handleChange(e, index, "year")}
            />
            <input
              type="text"
              name="education"
              placeholder="GPA"
              value={edu.gpa}
              onChange={(e) => handleChange(e, index, "gpa")}
            />
            <input
              type="text"
              name="education"
              placeholder="Honors"
              value={edu.honors}
              onChange={(e) => handleChange(e, index, "honors")}
            />
          </div>
        ))}
        <button type="button" onClick={addEducation} className="add-button">
          Add Education
        </button>

        <div className="section-toggle">
          <button 
            type="button" 
            onClick={() => {
              setShowExperience(!showExperience);
              if (!showExperience && formData.experience.length === 0) {
                setFormData({
                  ...formData,
                  experience: [{ title: "", company: "", duration: "", description: "" }]
                });
              }
            }} 
            className={`toggle-button ${showExperience ? 'active' : ''}`}
          >
            {showExperience ? 'Hide Experience Section' : 'Add Experience Section'}
          </button>
        </div>

        {showExperience && (
          <>
            <h2>Experience</h2>
            {formData.experience.map((exp, index) => (
              <div key={index} className="experience-entry">
                <input
                  type="text"
                  name="experience"
                  placeholder="Job Title"
                  value={exp.title}
                  onChange={(e) => handleChange(e, index, "title")}
                  required={showExperience}
                />
                <input
                  type="text"
                  name="experience"
                  placeholder="Company"
                  value={exp.company}
                  onChange={(e) => handleChange(e, index, "company")}
                  required={showExperience}
                />
                <input
                  type="text"
                  name="experience"
                  placeholder="Duration (e.g., 2020-2022)"
                  value={exp.duration}
                  onChange={(e) => handleChange(e, index, "duration")}
                />
                <textarea
                  name="experience"
                  placeholder="Job Description"
                  value={exp.description}
                  onChange={(e) => handleChange(e, index, "description")}
                  className="experience-description"
                />
              </div>
            ))}
            <button type="button" onClick={addExperience} className="add-button">+ Add Experience</button>
          </>
        )}

        <h2>Summary</h2>
        <textarea
          name="summary"
          placeholder="Write a brief summary..."
          value={formData.summary}
          onChange={handleChange}
          required
        />

        <button type="button" onClick={handleCreateResume} className="create-resume-button">
          Create Resume
        </button>

      </form>
    </div>
  );
};

export default ResumeInput;
