const express = require('express');
const router = express.Router();
const aiScraperController = require('../controllers/aiScraperController');

// Route for searching person information
router.post('/search-person', aiScraperController.searchPerson);

// Route for searching organization employees
router.post('/search-organization', aiScraperController.searchOrganization);

module.exports = router;
