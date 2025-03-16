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
        const response = await fetch("http://localhost:5000/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)  // ✅ Use state directly
        });

        const data = await response.json();

        if (response.ok) {
            console.log("Signup successful", data);
            navigate("/dashboard");  // ✅ Redirect user on successful signup
        } else {
            console.error("Signup failed", data);
            setError(data.error || "Signup failed");
        }
    } catch (error) {
        console.error("Error during signup", error);
        setError("Something went wrong. Please try again.");
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
        </div>
      </div>
    </div>
  );
};

export default Signup;
