const express = require('express');
const router = express.Router();
const regionalDataController = require('../controllers/regionalDataController');
const { authenticateAdmin } = require('../middleware/auth'); // Assuming you have auth middleware

// Get regional data with filters and pagination
router.get('/', async (req, res) => {
    await regionalDataController.getRegionalData(req, res);
});

// Admin routes - protected endpoints
router.use(authenticateAdmin);

// Add or update single region data
router.post('/update', async (req, res) => {
    await regionalDataController.updateRegionalData(req, res);
});

// Bulk update regional data
router.post('/bulk-update', async (req, res) => {
    await regionalDataController.bulkUpdateRegionalData(req, res);
});

// Update Indian salary data
router.post('/update-india', async (req, res) => {
    await regionalDataController.updateIndianSalaryData(req, res);
});

module.exports = router; 