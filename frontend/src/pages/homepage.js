import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/homepage.css";
import logo from "../assets/logo.png"; // Ensure your logo is in src/assets/

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="homepage-container">
      <div className="left-section"></div>
      <div className="right-section">
        <img src={logo} alt="CareerSphere Logo" className="logo" />
        <button className="get-started-btn" onClick={() => navigate("/signup")}>
          Get Started!
        </button>
      </div>
    </div>
  );
};

export default HomePage;
