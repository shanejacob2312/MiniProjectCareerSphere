import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // For navigation
import axios from "axios";
import "../styles/login.css";
import loginBg from "../assets/loginbg.jpg"; // Ensure correct path

const Login = () => {
  const navigate = useNavigate(); // React Router hook for navigation
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
  
    console.log("Attempting login with:", { email, password });
  
    try {
      const response = await axios.post("http://localhost:5000/api/auth/login", {
        email: email.trim(), // Remove extra spaces
        password: password.toString().trim(), // Ensure it's a string
      });
      
  
      console.log("Login Response:", response.data);
  
      if (response.status === 200 && response.data.token) {
        localStorage.setItem("token", response.data.token);
        navigate("/dashboard");
      } else {
        setError(response.data.message || "Invalid credentials. Please try again.");
      }
    } catch (err) {
      console.error("Login Error:", err);
  
      if (err.response) {
        console.log("Error Response Data:", err.response.data); // ✅ Log error details
        setError(err.response.data.message || "Login failed. Check your credentials.");
      } else {
        setError("Server is unreachable. Try again later.");
      }
    }
  };
  
  

  return (
    <div className="login-container">
      {/* Left Side (Image & Text) */}
      <div className="login-left">
        <img src={loginBg} alt="Background" className="login-bg" />
        <div className="overlay-text">
          <h1>Create a Resume Instantly</h1>
          <h1>Upload & Manage Resumes</h1>
          <h1>Build Your Professional Brand</h1>
        </div>
      </div>

      {/* Right Side (Login Form) */}
      <div className="login-right">
        <div className="login-box">
          <h2>Login</h2>
          {error && <p className="error-message">{error}</p>}
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="E-Mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="on"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit">Login</button>
          </form>
          
          {/* Forgot Password Button */}
          <button className="forgot-password-btn" onClick={() => navigate("/forgotpassword")}>
            Forgot Password?
          </button>

          <p>
            Don't have an account? <a href="/signup">Sign Up Here.</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
