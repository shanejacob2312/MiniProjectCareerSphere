const express = require('express');
const router = express.Router();
const Resume = require('../models/resume');
const auth = require('../middleware/auth');

// Get all resumes for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching resumes for user:', req.user.id);
    const resumes = await Resume.find({ userId: req.user.id });
    console.log('Found resumes:', resumes);
    res.json(resumes);
  } catch (err) {
    console.error('Detailed error fetching resumes:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    res.status(500).json({ 
      message: 'Error fetching resumes',
      error: err.message 
    });
  }
});

// Create a new resume
router.post('/', auth, async (req, res) => {
  try {
    const resume = new Resume({
      ...req.body,
      userId: req.user.id
    });
    await resume.save();
    res.status(201).json(resume);
  } catch (err) {
    console.error('Error creating resume:', err);
    res.status(500).json({ message: 'Error creating resume' });
  }
});

// Upload a resume file
router.post('/upload', auth, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const resume = new Resume({
      name: req.body.name,
      fileUrl: req.file.path,
      type: req.body.type,
      userId: req.user.id
    });
    await resume.save();
    res.status(201).json(resume);
  } catch (err) {
    console.error('Error uploading resume:', err);
    res.status(500).json({ message: 'Error uploading resume' });
  }
});

// Get a specific resume
router.get('/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.user.id });
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    res.json(resume);
  } catch (err) {
    console.error('Error fetching resume:', err);
    res.status(500).json({ message: 'Error fetching resume' });
  }
});

// Update a resume
router.put('/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    res.json(resume);
  } catch (err) {
    console.error('Error updating resume:', err);
    res.status(500).json({ message: 'Error updating resume' });
  }
});

// Delete a resume
router.delete('/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    res.json({ message: 'Resume deleted successfully' });
  } catch (err) {
    console.error('Error deleting resume:', err);
    res.status(500).json({ message: 'Error deleting resume' });
  }
});

module.exports = router; 