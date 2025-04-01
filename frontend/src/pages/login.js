import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/login.css";
import loginBg from "../assets/loginbg.jpg";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
  
    try {
      console.log("Attempting login with email:", email);
      const response = await axios.post("http://localhost:5000/api/auth/login", {
        email: email.trim(),
        password: password.trim(),
      });
      
      console.log("Login response received:", response.data);
      
      if (response.data.token) {
        console.log("Token received, storing in localStorage");
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        console.log("Navigating to dashboard");
        navigate("/dashboard");
      } else {
        console.error("No token in response");
        setError("Invalid response from server");
      }
    } catch (err) {
      console.error("Login Error Details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      if (err.response) {
        setError(err.response.data.message || "Login failed. Check your credentials.");
      } else if (err.request) {
        setError("No response from server. Please check if the server is running.");
      } else {
        setError("Error setting up the request. Please try again.");
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
