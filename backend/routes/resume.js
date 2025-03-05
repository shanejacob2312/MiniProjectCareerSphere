const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage });

// Upload resume endpoint
router.post("/upload", upload.single("resume"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: "No file uploaded" });
    }
    res.json({ filePath: `/uploads/${req.file.filename}` });
});

// Serve uploaded files
router.get("/:filename", (req, res) => {
    const filePath = path.join(__dirname, "../uploads", req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ msg: "File not found" });
    }
});
router.get("/list", (req, res) => {
    const uploadPath = path.join(__dirname, "../uploads");

    fs.readdir(uploadPath, (err, files) => {
        if (err) {
            return res.status(500).json({ msg: "Error reading files" });
        }
        res.json(files);
    });
});


module.exports = router;
