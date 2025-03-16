const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan"); // Logs API requests
const path = require("path");
const multer = require("multer");
const fs = require("fs"); // Import `fs` for file operations
const extractTextFromPDF = require("./utils/extracttext"); // Create this file for text extraction

dotenv.config(); // Load environment variables

// Import routes
const authRoutes = require("./routes/auth");
const resumeAnalysisRoutes = require("./routes/resumeanalysis");
// const aiAnalysisRoutes = require("./routes/aianalysis"); // Ensure this is the correct file
const uploadRoutes = require("./routes/uploads"); // New route for file upload


const app = express(); // Initialize Express App
const upload = multer({ dest: "uploads/" });

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev")); // Logs API requests

// Static Files (for file uploads)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1); // Exit process if connection fails
  }
};
connectDB();

// Test Route
app.get("/", (req, res) => {
  res.send("🚀 CareerSphere Backend is Running!");
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/resume", resumeAnalysisRoutes);
// app.use("/api/ai", aiAnalysisRoutes);
app.use("/api/upload", uploadRoutes); // File upload route





// ✅ Updated Route for Text Extraction
app.post("/api/extracttext", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = path.join(__dirname, req.file.path);
    const extractedText = await extractTextFromPDF(filePath);

    // Delete the uploaded file after extracting text
    fs.unlinkSync(filePath);

    res.json({ text: extractedText });
  } catch (error) {
    console.error("Error extracting text:", error);
    res.status(500).json({ error: "Failed to extract text from PDF" });
  }
});


// Handle 404 (Undefined Routes)
app.use((req, res, next) => {
  res.status(404).json({ error: "Route Not Found" });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
