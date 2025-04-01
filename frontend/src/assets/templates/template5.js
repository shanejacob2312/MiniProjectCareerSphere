import React from 'react';
import './template5.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faPhone, faLocationDot, faGlobe } from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types';

const Template5 = ({ formData = {} }) => {
  const {
    fullName = 'Your Name',
    email = '',
    phone = '',
    location = '',
    website = '',
    jobTitle = 'Professional Title',
    professionalSummary = 'No professional summary provided',
    skills = [],
    experience = [],
    education = []
  } = formData;

  return (
    <div className="template5">
      <header className="header">
        <h1 className="name">{fullName}</h1>
        <div className="job-title">{jobTitle}</div>
        
        <div className="contact-info">
          {email && (
            <div className="contact-item">
              <FontAwesomeIcon icon={faEnvelope} />
              <span>{email}</span>
            </div>
          )}
          {phone && (
            <div className="contact-item">
              <FontAwesomeIcon icon={faPhone} />
              <span>{phone}</span>
            </div>
          )}
          {location && (
            <div className="contact-item">
              <FontAwesomeIcon icon={faLocationDot} />
              <span>{location}</span>
            </div>
          )}
          {website && (
            <div className="contact-item">
              <FontAwesomeIcon icon={faGlobe} />
              <span>{website}</span>
            </div>
          )}
        </div>
      </header>

      <section className="section">
        <h2 className="section-title">Professional Summary</h2>
        <p className="summary">{professionalSummary}</p>
      </section>

      <section className="section">
        <h2 className="section-title">Skills</h2>
        <div className="skills-container">
          {skills.length > 0 ? (
            skills.map((skill, index) => (
              <span key={index} className="skill-item">
                {skill.name}
                <span className="skill-level">{skill.level}</span>
                {skill.yearsOfExperience > 0 && (
                  <span className="skill-years">{skill.yearsOfExperience}y</span>
                )}
              </span>
            ))
          ) : (
            <div className="no-content">No skills listed</div>
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Professional Experience</h2>
        {experience.length > 0 ? (
          experience.map((exp, index) => (
            <div key={index} className="experience-item">
              <h3 className="role-title">{exp.title}</h3>
              <div className="company-name">{exp.company}</div>
              <div className="duration">{exp.duration}</div>
              <p className="description">{exp.description}</p>
            </div>
          ))
        ) : (
          <div className="no-content">No experience listed</div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Education</h2>
        {education.length > 0 ? (
          education.map((edu, index) => (
            <div key={index} className="education-item">
              <h3 className="degree">{edu.degree}</h3>
              <div className="institution">{edu.institution}</div>
              <div className="graduation-year">{edu.year}</div>
            </div>
          ))
        ) : (
          <div className="no-content">No education listed</div>
        )}
      </section>
    </div>
  );
};

Template5.propTypes = {
  formData: PropTypes.shape({
    fullName: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    location: PropTypes.string,
    website: PropTypes.string,
    jobTitle: PropTypes.string,
    professionalSummary: PropTypes.string,
    skills: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      level: PropTypes.string,
      yearsOfExperience: PropTypes.number
    })),
    experience: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string,
      company: PropTypes.string,
      duration: PropTypes.string,
      description: PropTypes.string
    })),
    education: PropTypes.arrayOf(PropTypes.shape({
      degree: PropTypes.string,
      institution: PropTypes.string,
      year: PropTypes.string
    }))
  })
};

export default Template5; 