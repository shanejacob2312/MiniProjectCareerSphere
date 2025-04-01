import React from "react";
import "./template3.css";

const Template3 = ({ data }) => {
  return (
    <div className="template3">
      <div className="header">
        <div className="name-section">
          <h1>{data.name}</h1>
          <div className="contact-info">
            <span>{data.email}</span>
            <span>•</span>
            <span>{data.phone}</span>
            <span>•</span>
            <span>{data.location}</span>
          </div>
        </div>
        <div className="job-title">{data.jobType}</div>
      </div>

      <div className="content">
        <div className="left-column">
          <section className="summary-section">
            <h2>Professional Summary</h2>
            <p>{data.summary}</p>
          </section>

          <section className="skills-section">
            <h2>Skills</h2>
            <div className="skills-grid">
              {data.skills.map((skill, index) => (
                <div key={index} className="skill-item">
                  <span className="skill-name">{skill.name}</span>
                  <span className="skill-level">{skill.level}</span>
                  {skill.yearsOfExperience > 0 && (
                    <span className="skill-years">{skill.yearsOfExperience} years</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="right-column">
          <section className="experience-section">
            <h2>Professional Experience</h2>
            {data.experience && data.experience.length > 0 ? (
              data.experience.map((exp, index) => (
                <div key={index} className="experience-item">
                  <div className="experience-header">
                    <h3>{exp.title}</h3>
                    <div className="experience-meta">
                      <span className="company">{exp.company}</span>
                      <span className="duration">{exp.duration}</span>
                    </div>
                  </div>
                  <p className="description">{exp.description}</p>
                </div>
              ))
            ) : (
              <p className="no-content">No professional experience listed</p>
            )}
          </section>

          <section className="education-section">
            <h2>Education</h2>
            {data.education.map((edu, index) => (
              <div key={index} className="education-item">
                <div className="education-header">
                  <h3>{edu.degree}</h3>
                  <span className="year">{edu.year}</span>
                </div>
                <p className="institution">{edu.institution}</p>
              </div>
            ))}
          </section>

          <section className="details-section">
            <div className="detail-item">
              <span className="label">Age:</span>
              <span className="value">{data.age}</span>
            </div>
            <div className="detail-item">
              <span className="label">Gender:</span>
              <span className="value">{data.gender}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Template3; 