const express = require("express");
const auth = require("../middleware/auth");

const router = express.Router();

// Placeholder for resume storage (consider using a model)
let resumes = {};

// Upload Resume
router.post("/upload", auth, (req, res) => {
    try {
        const { userId, resumeData } = req.body;
        if (!resumeData) return res.status(400).json({ message: "No resume data provided" });

        resumes[userId] = resumeData;
        res.json({ message: "Resume uploaded successfully", resume: resumeData });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});

// Get Resume
router.get("/get", auth, (req, res) => {
    try {
        const resume = resumes[req.user.id];
        if (!resume) return res.status(404).json({ message: "No resume found" });

        res.json(resume);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});

module.exports = router;
