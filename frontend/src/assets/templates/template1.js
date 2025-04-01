import React from "react";
import "./template1.css";

const Template1 = ({ data }) => {
  return (
    <div className="template1">
      <h1>{data.name}</h1>
      <p><strong>Age:</strong> {data.age}</p>
      <p><strong>Location:</strong> {data.location}</p>
      <p><strong>Gender:</strong> {data.gender}</p>
      <p><strong>Phone:</strong> {data.phone}</p>
      <p><strong>Email:</strong> {data.email}</p>

      <h2>Experience</h2>
      {data.experience && data.experience.length > 0 ? (
        data.experience.map((exp, index) => (
          <div key={index} className="experience-item">
            <h3>{exp.title} at {exp.company}</h3>
            <p className="duration">{exp.duration}</p>
            <p className="description">{exp.description}</p>
          </div>
        ))
      ) : (
        <p>No experience listed</p>
      )}

      <h2>Education</h2>
      {data.education.map((edu, index) => (
        <p key={index}>
          <strong>{edu.degree}</strong> - {edu.institution} ({edu.year})
        </p>
      ))}

      <h2>Skills</h2>
      <ul>
        {data.skills.map((skill, index) => (
          <li key={index}>
            {skill.name} - {skill.level}
            {skill.yearsOfExperience > 0 && ` (${skill.yearsOfExperience} years)`}
          </li>
        ))}
      </ul>

      <h2>Summary</h2>
      <p>{data.summary}</p>
    </div>
  );
};

export default Template1;
