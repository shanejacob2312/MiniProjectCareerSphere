const express = require("express");
const bcryptjs = require("bcryptjs"); // Using bcryptjs instead of bcrypt
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const rateLimit = require('express-rate-limit');
require("dotenv").config();
const router = express.Router();

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { message: "Too many attempts, please try again later" }
});

// Secure email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  secure: true // Use TLS
});

// Input validation middleware
const validateSignupInput = (req, res, next) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters long" });
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }
  
  next();
};

// ✅ Signup Route
router.post("/signup", validateSignupInput, async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    let user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    // Create new user
      user = new User({
          name,
      email: email.toLowerCase(),
      password
    });

    try {
      await user.validate(); // Explicitly run validation
    } catch (validationError) {
      // Handle validation errors
      if (validationError.errors) {
        const errorMessages = Object.values(validationError.errors)
          .map(err => err.message);
        return res.status(400).json({ 
          message: errorMessages.join('. ')
        });
      }
      throw validationError; // Re-throw if it's not a validation error
    }

      await user.save();

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(201).json({ 
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
      console.error("Signup Error:", err);
    
    // Handle duplicate key error (email already exists)
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: "Email is already registered" 
      });
    }
    
    // Handle validation errors that might have slipped through
    if (err.name === 'ValidationError') {
      const errorMessages = Object.values(err.errors)
        .map(error => error.message);
      return res.status(400).json({ 
        message: errorMessages.join('. ')
      });
    }

    res.status(500).json({ 
      message: "Server error during registration",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ✅ Login Route
router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if account is locked
    if (user.accountLocked && user.accountLockExpires > Date.now()) {
      const remainingTime = Math.ceil((user.accountLockExpires - Date.now()) / 1000 / 60);
      return res.status(423).json({ 
        message: `Account is temporarily locked. Please try again in ${remainingTime} minutes.` 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Increment failed login attempts
      await user.incrementLoginAttempts();
      
      if (user.accountLocked) {
        return res.status(423).json({ 
          message: "Too many failed attempts. Account is temporarily locked for 15 minutes." 
        });
      }
      
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Reset failed login attempts on successful login
    await user.resetLoginAttempts();

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { 
        expiresIn: "24h",
        algorithm: 'HS256'
      }
    );

    // Set secure cookie with token
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({ 
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
      console.error("Login Error:", err);
    res.status(500).json({ 
      message: "Server error during login",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Forgot Password Route
router.post("/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body;
  
  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal whether a user exists
      return res.status(200).json({ message: "If an account exists, a password reset email has been sent" });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    // Save hashed reset token to user
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // Create reset URL with unhashed token
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send email with secure configuration
    const mailOptions = {
      from: {
        name: 'CareerSphere Support',
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: "Password Reset Request - CareerSphere",
      html: `
        <h1>Password Reset Request</h1>
        <p>You requested a password reset for your CareerSphere account.</p>
        <p>Click this <a href="${resetUrl}">link</a> to reset your password.</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email and ensure your account is secure.</p>
        <p>Best regards,<br>CareerSphere Team</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "If an account exists, a password reset email has been sent" });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Error processing password reset request" });
  }
});

// Reset Password Route
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }

    // Hash the token from params to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Validate password format before hashing
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        message: "Password must contain at least 8 characters, including uppercase, lowercase, numbers and special characters" 
      });
    }

    // Hash new password
    const salt = await bcryptjs.genSalt(12);
    const hashedPassword = await bcryptjs.hash(password, salt);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    // Save without validation
    await user.save({ validateBeforeSave: false });

    // Notify user of password change
    const mailOptions = {
      from: {
        name: 'CareerSphere Support',
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: 'Password Reset Successful',
      html: `
        <h1>Password Reset Successful</h1>
        <p>Your password has been successfully reset.</p>
        <p>If you did not make this change, please contact support immediately.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Password reset successful" });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// Logout Route
router.post("/logout", (req, res) => {
  res.clearCookie('token');
  res.json({ message: "Logged out successfully" });
});

module.exports = router;