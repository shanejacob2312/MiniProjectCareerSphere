import React from "react";
import "./template2.css";

const Template2 = ({ data }) => {
  return (
    <div className="template2">
      <header>
        <h1>{data.name}</h1>
        <div className="contact-info">
          <p>{data.email} | {data.phone}</p>
          <p>{data.location} | {data.age} years old | {data.gender}</p>
        </div>
      </header>

      <section className="summary">
        <h2>Professional Summary</h2>
        <p>{data.summary}</p>
      </section>

      <section className="experience">
        <h2>Professional Experience</h2>
        {data.experience && data.experience.length > 0 ? (
          data.experience.map((exp, index) => (
            <div key={index} className="experience-item">
              <div className="experience-header">
                <h3>{exp.title}</h3>
                <span className="company">{exp.company}</span>
                <span className="duration">{exp.duration}</span>
              </div>
              <p className="description">{exp.description}</p>
            </div>
          ))
        ) : (
          <p>No professional experience listed</p>
        )}
      </section>

      <section className="education">
        <h2>Education</h2>
        {data.education.map((edu, index) => (
          <div key={index} className="education-item">
            <h3>{edu.degree}</h3>
            <p>{edu.institution} - {edu.year}</p>
          </div>
        ))}
      </section>

      <section className="skills">
        <h2>Skills</h2>
        <ul>
          {data.skills.map((skill, index) => (
            <li key={index}>
              {skill.name} - {skill.level}
              {skill.yearsOfExperience > 0 && ` (${skill.yearsOfExperience} years)`}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default Template2;
