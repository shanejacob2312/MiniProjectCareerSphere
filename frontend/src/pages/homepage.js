import React from "react";
import { Link } from "react-router-dom"; // Import Link for navigation
import "../styles/homepage.css"; // Import CSS

const Homepage = () => {
    return (
        <div className="homepage-container">
            <div className="overlay"></div> {/* Dark overlay */}

            {/* Login Button - Top Right */}
            <Link to="/login" className="login-btn">
                Login
            </Link>

            {/* Centered Content */}
            <div className="content-box">
                <h1>Build Your Resume with AI</h1>
                <p>Effortlessly create, edit, and analyze your resume.</p>
                <Link to="/signup" className="get-started-btn">
                    Get Started!
                </Link>
            </div>
        </div>
    );
};

export default Homepage;
