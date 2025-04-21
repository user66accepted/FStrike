const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// Sending profile routes
router.post('/SaveProfile', profileController.saveProfile);
router.get('/GetProfiles', profileController.getProfiles);
router.get('/GetProfile/:id', profileController.getProfile);
router.put('/UpdateProfile/:id', profileController.updateProfile);
router.delete('/DeleteProfile/:id', profileController.deleteProfile);

module.exports = router; 