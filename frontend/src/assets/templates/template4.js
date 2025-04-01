import React from 'react';
import './template4.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faPhone, faLocationDot, faGlobe } from '@fortawesome/free-solid-svg-icons';
import PropTypes from 'prop-types';

const Template4 = ({ formData = {} }) => {
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
    <div className="template4">
      <div className="sidebar">
        <div className="profile-section">
          <h1>{fullName}</h1>
          <div className="job-title">{jobTitle}</div>
          
          <div className="contact-details">
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
        </div>

        <div className="skills-section">
          <h2>Skills</h2>
          <div className="skills-container">
            {skills.length > 0 ? (
              skills.map((skill, index) => (
                <span key={index} className="skill-tag">
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
        </div>
      </div>

      <div className="main-content">
        <section className="summary-section">
          <h2>Professional Summary</h2>
          <p>{professionalSummary}</p>
        </section>

        <section className="experience-section">
          <h2>Professional Experience</h2>
          <div className="section-content">
            {experience.length > 0 ? (
              experience.map((exp, index) => (
                <div key={index} className="experience-item">
                  <div className="timeline-dot"></div>
                  <div className="experience-content">
                    <div className="experience-header">
                      <h3>{exp.title}</h3>
                      <span className="duration">{exp.duration}</span>
                    </div>
                    <div className="company-name">{exp.company}</div>
                    <p className="description">{exp.description}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-content">No experience listed</div>
            )}
          </div>
        </section>

        <section className="education-section">
          <h2>Education</h2>
          <div className="section-content">
            {education.length > 0 ? (
              education.map((edu, index) => (
                <div key={index} className="education-item">
                  <div className="timeline-dot"></div>
                  <div className="education-content">
                    <h3>{edu.degree}</h3>
                    <div className="institution">{edu.institution}</div>
                    <div className="year">{edu.year}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-content">No education listed</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

Template4.propTypes = {
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

export default Template4; 