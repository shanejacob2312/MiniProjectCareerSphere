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

    try {
      const response = await axios.post("http://localhost:5000/api/auth/login", {
        email,
        password,
      });

      if (response.data.success) {
        localStorage.setItem("token", response.data.token); // Store token
        navigate("/dashboard"); // Redirect to dashboard
      } else {
        setError("Invalid credentials. Please try again.");
      }
    } catch (err) {
      setError("Login failed. Check your credentials.");
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
          <p>
            Don't have an account? <a href="/signup">Sign Up Here.</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
