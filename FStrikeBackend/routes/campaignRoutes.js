const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');

// Campaign routes
router.post('/SaveCampaign', campaignController.saveCampaign);
router.get('/GetCampaigns', campaignController.getCampaigns);
router.delete('/DeleteCampaign/:id', campaignController.deleteCampaign);
router.post('/LaunchCampaign/:id', campaignController.launchCampaign);
router.post('/CloseCampaign/:id', campaignController.closeCampaign);
router.get('/GetCampaignLogs/:id', campaignController.getCampaignLogs);
router.get('/GetFormSubmissions/:id', campaignController.getFormSubmissions);

module.exports = router; 