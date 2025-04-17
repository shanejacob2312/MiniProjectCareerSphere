const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan"); // Logs API requests
const path = require("path");
const multer = require("multer");
const fs = require("fs"); // Import `fs` for file operations
const extractTextFromPDF = require("./utils/extracttext"); // Create this file for text extraction
const resumesRouter = require('./routes/resumes');
const { verifyApiKey } = require('./utils/analyzeresume');

dotenv.config(); // Load environment variables

// Import routes
const authRoutes = require("./routes/auth");
const resumeAnalysisRoutes = require("./routes/resumeanalysis");
const uploadRoutes = require("./routes/uploads"); // New route for file upload

const app = express(); // Initialize Express App

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// CORS Configuration
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan("dev")); // Logs API requests

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Static Files (for file uploads)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Initialize services
const initializeServices = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected Successfully");

    // Verify HuggingFace API key
    await verifyApiKey();
    console.log("✅ HuggingFace API Key Verified Successfully");

  } catch (err) {
    console.error("❌ Service Initialization Error:", err);
    process.exit(1); // Exit process if initialization fails
  }
};

// Test Route
app.get("/", (req, res) => {
  res.send("CareerSphere Backend is Running!");
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/resumeanalysis", resumeAnalysisRoutes);
app.use("/api/upload", uploadRoutes); // File upload route
app.use('/api/resumes', resumesRouter);

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
    if (error.message.includes('Only PDF files are allowed')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to extract text from PDF" });
  }
});

// Handle 404 (Undefined Routes)
app.use((req, res, next) => {
  res.status(404).json({ 
    status: 'error',
    message: "Route Not Found",
    path: req.path
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("💥 Server Error:", {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    body: req.body
  });

  // Handle Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File is too large. Maximum size is 5MB'
      });
    }
    return res.status(400).json({
      status: 'error',
      message: err.message
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'error',
      message: Object.values(err.errors).map(e => e.message).join(', ')
    });
  }

  // Handle duplicate key errors
  if (err.code === 11000) {
    return res.status(400).json({
      status: 'error',
      message: 'Duplicate value entered'
    });
  }

  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server only after services are initialized
const startServer = async () => {
  try {
    await initializeServices();
    
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('Environment variables loaded:', {
        MONGODB_URI: process.env.MONGODB_URI ? '✓' : '✗',
        JWT_SECRET: process.env.JWT_SECRET ? '✓' : '✗',
        EMAIL_USER: process.env.EMAIL_USER ? '✓' : '✗',
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '✓' : '✗',
        HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY ? '✓' : '✗'
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
