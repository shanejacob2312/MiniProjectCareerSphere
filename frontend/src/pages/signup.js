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
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    
    // Name validation
    if (!userData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (userData.name.length < 2) {
      newErrors.name = "Name must be at least 2 characters long";
    } else if (userData.name.length > 50) {
      newErrors.name = "Name cannot exceed 50 characters";
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userData.email) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(userData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!userData.password) {
      newErrors.password = "Password is required";
    } else if (userData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    } else if (!passwordRegex.test(userData.password)) {
      newErrors.password = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/signup",
        userData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          withCredentials: true
        }
      );

      if (response.status === 201 && response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error during signup:", error);
      
      if (error.response?.data?.message) {
        // Handle specific error messages from the server
        if (error.response.data.message.includes("already exists")) {
          setErrors(prev => ({ ...prev, email: "This email is already registered" }));
        } else {
          setErrors(prev => ({ ...prev, submit: error.response.data.message }));
        }
      } else {
        setErrors(prev => ({ 
          ...prev, 
          submit: "An error occurred during signup. Please try again." 
        }));
      }
    } finally {
      setIsSubmitting(false);
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
          {errors.submit && (
            <div className="error-message global-error">
              {errors.submit}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <input 
                type="text" 
                name="name" 
                placeholder="Name" 
                value={userData.name}
                onChange={handleChange}
                className={errors.name ? "error" : ""}
                disabled={isSubmitting}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <input 
                type="email" 
                name="email" 
                placeholder="E-Mail" 
                value={userData.email}
                onChange={handleChange}
                className={errors.email ? "error" : ""}
                disabled={isSubmitting}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="form-group">
              <input 
                type="password" 
                name="password" 
                placeholder="Password" 
                value={userData.password}
                onChange={handleChange}
                className={errors.password ? "error" : ""}
                disabled={isSubmitting}
              />
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className={isSubmitting ? "submitting" : ""}
            >
              {isSubmitting ? "Signing Up..." : "Sign Up"}
            </button>
          </form>

          <p>
            Already have an account? <a href="/login">Login Here</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
