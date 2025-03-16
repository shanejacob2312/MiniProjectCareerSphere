const express = require("express");
const multer = require("multer");
const extractTextFromPDF = require("../utils/extracttext");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Upload & Extract Text
router.post("/", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = path.join(__dirname, "..", req.file.path);
    const extractedText = await extractTextFromPDF(filePath);

    // Delete file after extraction
    fs.unlinkSync(filePath);

    res.json({ text: extractedText });
  } catch (error) {
    console.error("Error extracting text:", error);
    res.status(500).json({ error: "Failed to process the resume" });
  }
});

module.exports = router;
