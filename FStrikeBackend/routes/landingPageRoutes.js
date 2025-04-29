const express = require('express');
const router = express.Router();
const landingPageController = require('../controllers/landingPageController');

// Landing page routes
router.post('/SavePage', landingPageController.savePage);
router.put('/UpdatePage/:id', landingPageController.updatePage);
router.get('/GetLandingPages', landingPageController.getLandingPages);
router.get('/GetLandingPage/:id', landingPageController.getLandingPage);
router.delete('/DeleteLandingPage/:id', landingPageController.deleteLandingPage);

module.exports = router;