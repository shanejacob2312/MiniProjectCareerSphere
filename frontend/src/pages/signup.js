import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/signup.css";
import signupBg from "../assets/signupbg.jpg"; // Ensure this image exists in the assets folder

const Signup = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post("http://localhost:5000/api/auth/signup", userData, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.success) {
        navigate("/login"); // Redirect to login page upon success
      } else {
        setError(response.data.message || "Signup failed");
      }
    } catch (err) {
      setError("Signup failed. Please check your details.");
    }
  };

  return (
    <div className="signup-container">
      {/* Left Side with Image & Text */}
      <div className="signup-left">
        <img src={signupBg} alt="Background" className="signup-bg" />
        <div className="overlay-text">
          <h1>Showcase Your Skills.<br />Stand Out.<br />Succeed.</h1>
        </div>
      </div>

      {/* Right Side with Form */}
      <div className="signup-right">
        <div className="signup-box">
          <h2>Create Account</h2>
          {error && <p className="error-message">{error}</p>}
          <form onSubmit={handleSubmit}>
            <input type="text" name="name" placeholder="Name" onChange={handleChange} required />
            <input type="email" name="email" placeholder="E-Mail" onChange={handleChange} required />
            <input type="password" name="password" placeholder="Password" onChange={handleChange} required />
            <button type="submit">Sign Up</button>
          </form>
          <p>
            Already have an account? <a href="/login">Login Here.</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
