const express = require("express");
const multer = require("multer");
const extractTextFromPDF = require("../utils/extracttext");
const analyzeResume = require("../utils/bertanalysis");
const router = express.Router();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Store uploaded PDFs in "uploads" folder
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Route to upload a PDF and extract text
router.post("/extracttext", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const extractedText = await extractTextFromPDF(req.file.path);
    res.json({ text: extractedText });
  } catch (error) {
    res.status(500).json({ error: "Error extracting text" });
  }
});

// AI Resume Analysis Route
router.post("/analyze", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "No text provided" });
  
      const analysis = await analyzeResume(text);
      res.json(analysis);
    } catch (error) {
      console.error("BERT Analysis Error:", error);
      res.status(500).json({ error: "Error analyzing resume" });
    }
  });
  
module.exports = router;
