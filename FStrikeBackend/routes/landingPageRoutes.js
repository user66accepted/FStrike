const express = require('express');
const router = express.Router();
const landingPageController = require('../controllers/landingPageController');

// Landing page routes
router.post('/SavePage', landingPageController.savePage);
router.get('/GetLandingPages', landingPageController.getLandingPages);
router.delete('/DeleteLandingPage/:id', landingPageController.deleteLandingPage);

module.exports = router; 