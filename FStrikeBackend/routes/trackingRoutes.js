const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * Tracking Routes
 * Handles all tracking pixel and campaign tracking endpoints
 */

let trackingService = null;
let io = null;

// Initialize services
const initServices = (tracking, socketIO) => {
  trackingService = tracking;
  io = socketIO;
};

// Direct tracking endpoint
router.get('/track', (req, res) => {
  console.log('🔍 Direct tracking pixel requested:', req.query.email);
  const pixelId = crypto.randomUUID();
  if (trackingService) {
    trackingService.logOpen(pixelId, req, res, io);
  } else {
    res.status(500).send('Tracking service not available');
  }
});

// Multiple tracking pixel endpoints for better compatibility
router.get('/tracker/:id.png', (req, res) => {
  console.log('🔍 PNG Tracking pixel requested:', req.params.id);
  if (trackingService) {
    trackingService.logOpen(req.params.id, req, res, io);
  } else {
    res.status(500).send('Tracking service not available');
  }
});

router.get('/track/:id/pixel.gif', (req, res) => {
  console.log('🔍 GIF Tracking pixel requested:', req.params.id);
  if (trackingService) {
    trackingService.logOpen(req.params.id, req, res, io);
  } else {
    res.status(500).send('Tracking service not available');
  }
});

router.get('/t/:id/p.png', (req, res) => {
  console.log('🔍 Alternative tracking pixel requested:', req.params.id);
  if (trackingService) {
    trackingService.logOpen(req.params.id, req, res, io);
  } else {
    res.status(500).send('Tracking service not available');
  }
});

// Test tracking pixel endpoint - for testing only
router.get('/test-tracker/:id', (req, res) => {
  const pixelId = req.params.id;
  console.log('📝 Test tracking endpoint called for pixel:', pixelId);
  // Redirect to the actual tracking pixel
  res.redirect(`/tracker/${pixelId}.png`);
});

module.exports = { router, initServices };
