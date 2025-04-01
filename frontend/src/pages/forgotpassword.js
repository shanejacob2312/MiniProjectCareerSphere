import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/forgotpassword.css";
import loginBg from "../assets/loginbg.jpg";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setIsLoading(true);

    try {
      console.log("Sending forgot password request for email:", email);
      const response = await axios.post("http://localhost:5000/api/auth/forgot-password", {
        email: email.trim()
      });

      console.log("Server response:", response.data);

      if (response.data.message) {
        setMessage(response.data.message);
        setEmail("");
      } else {
        setError("No response message from server");
      }
    } catch (err) {
      console.error("Forgot Password Error Details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        setError(err.response.data.message || "Server error. Please try again.");
      } else if (err.request) {
        // The request was made but no response was received
        setError("No response from server. Please check if the server is running.");
      } else {
        // Something happened in setting up the request that triggered an Error
        setError("Error setting up the request. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      {/* Left Side (Image & Text) */}
      <div className="forgot-password-left">
        <img src={loginBg} alt="Background" className="forgot-password-bg" />
        <div className="overlay-text">
          <h1>Reset Your Password</h1>
          <h1>We'll Help You Get Back In</h1>
        </div>
      </div>

      {/* Right Side (Form) */}
      <div className="forgot-password-right">
        <div className="forgot-password-box">
          <h2>Forgot Password</h2>
          {message && <p className="success-message">{message}</p>}
          {error && <p className="error-message">{error}</p>}
          
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <button className="back-to-login" onClick={() => navigate("/login")}>
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
