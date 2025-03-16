import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import createResumeIcon from "../assets/createicon.png";
import uploadResumeIcon from "../assets/uploadicon.png";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="dashboard-container">
      <div className="action-buttons">
        <div className="dashboard-button" onClick={() => navigate("/resumeinput")}>
          <img src={createResumeIcon} alt="Create Resume" className="button-icon" />
          <button className="btn">Create a Resume</button>
        </div>
        <div className="dashboard-button" onClick={() => navigate("/uploadresume")}>
          <img src={uploadResumeIcon} alt="Upload Resume" className="button-icon" />
          <button className="btn">Upload a Resume</button>
        </div>
      </div>

      <div className="view-resumes-section">
        <h2>View Resumes</h2>
        <div className="resumes-grid">
          {/* Resumes will be displayed here in grid format */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
