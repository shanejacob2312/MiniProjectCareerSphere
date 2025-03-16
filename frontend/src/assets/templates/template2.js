import React from "react";
import "./template2.css";

const Template2 = ({ data }) => {
  return (
    <div className="template2">
      <header>
        <h1>{data.name}</h1>
        <p>{data.email} | {data.phone}</p>
      </header>

      <section>
        <h2>Education</h2>
        {data.education.map((edu, index) => (
          <p key={index}>
            <strong>{edu.degree}</strong> - {edu.institution} ({edu.year})
          </p>
        ))}
      </section>

      <section>
        <h2>Skills</h2>
        <p>{data.skills.join(", ")}</p>
      </section>

      <section>
        <h2>Summary</h2>
        <p>{data.summary}</p>
      </section>
    </div>
  );
};

export default Template2;
