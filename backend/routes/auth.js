const express = require("express");
const bcrypt = require("bcrypt"); // Ensure it's bcrypt, NOT bcryptjs
const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();
const router = express.Router();

// ✅ Signup Route
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
      let user = await User.findOne({ email });
      if (user) {
          return res.status(400).json({ message: "User already exists" });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      console.log("Plain Password:", password);
      console.log("Hashed Password:", hashedPassword);

      user = new User({
          name,
          email,
          password: hashedPassword,
      });

      await user.save();
      res.status(201).json({ message: "User registered successfully" });

  } catch (err) {
      console.error("Signup Error:", err);
      res.status(500).json({ message: "Server error" });
  }
});



// ✅ Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Login Attempt:", email, password); // Debug log ✅

  try {
      const user = await User.findOne({ email });

      if (!user) {
          console.log("User not found ❌");
          return res.status(400).json({ message: "Invalid email or password" });
      }

      console.log("User Found:", user); // Debug log ✅
      console.log("Stored Password in DB:", user.password); // Log hashed password in DB

      console.log("Entered Password:", password);
      console.log("Stored Hashed Password:", user.password);

      const isMatch = await bcrypt.compare(password, user.password);
      console.log("Password Match Result:", isMatch);

      console.log("Password Match:", isMatch); // Debug log ✅

      if (!isMatch) {
          console.log("Password incorrect ❌");
          return res.status(400).json({ message: "Invalid email or password" });
      }

      res.json({ message: "Login successful!" });

  } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;