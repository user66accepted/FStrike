const db = require('../database');
const path = require('path');
const { createCanvas } = require('canvas');
const config = require('../config');

// Function to generate a 1x1 transparent pixel
const generateWebBug = () => {
  // Create a 1x1 canvas
  const canvas = createCanvas(1, 1);
  const ctx = canvas.getContext('2d');
  
  // Make it transparent
  ctx.clearRect(0, 0, 1, 1);
  
  // Add a single white pixel to ensure the image is valid
  ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
  ctx.fillRect(0, 0, 1, 1);
  
  return canvas.toBuffer('image/png');
};

// Transparent 1x1 pixel as a base64 string for fallback
const TRANSPARENT_PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// Function to generate a tracking URL for a particular email/campaign
const generateTrackingUrl = async (pixelId) => {
  // Add cache-busting parameter and multiple formats for better compatibility
  const urls = [
    `${config.trackingUrl}/tracker/${pixelId}.png?t=${Date.now()}`,
    `${config.trackingUrl}/track/${pixelId}/pixel.gif?t=${Date.now()}`,
    `${config.trackingUrl}/t/${pixelId}/p.png?t=${Date.now()}`
  ];
  return urls;
};

// Handle email open events
const logOpen = async (pixelId, req, res, io) => {
  console.log(`📊 Web bug requested: ${pixelId}`);
  
  // Extract client information with multiple fallbacks
  const ip = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.connection.remoteAddress;
             
  const ua = req.get('User-Agent');
  const mailClient = detectEmailClient(ua);

  // Add additional headers for better caching prevention
  const headers = {
    'Content-Type': 'image/png',
    'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Last-Modified': (new Date()).toUTCString(),
    'ETag': `"${Date.now()}"`,
    'Vary': '*'
  };

  // Apply headers
  Object.entries(headers).forEach(([key, value]) => res.set(key, value));

  // 1) Verify pixel exists and get user email with better error handling
  db.get(
    `SELECT tp.id, tp.user_email, tp.campaign_id, c.name as campaign_name 
     FROM tracking_pixels tp
     JOIN Campaigns c ON tp.campaign_id = c.id
     WHERE tp.id = ?`,
    [pixelId],
    async (err, row) => {
      if (err || !row) {
        console.error('❌ Error verifying pixel:', err);
        return res.send(TRANSPARENT_PIXEL);
      }

      console.log(`✅ Found tracking pixel for user: ${row.user_email}, campaign: ${row.campaign_name}, client: ${mailClient}`);

      // Log every open attempt with client info
      db.run(
        `INSERT INTO open_logs (pixel_id, ip, userAgent, email_client) VALUES (?, ?, ?, ?)`,
        [pixelId, ip, ua, mailClient],
        function(err) {
          if (err) {
            console.error('❌ Error logging open:', err);
          } else {
            console.log(`✅ Successfully logged open with ID: ${this.lastID} for pixel: ${pixelId}`);
            
            if (io) {
              const openData = {
                campaignId: row.campaign_id,
                campaignName: row.campaign_name,
                userEmail: row.user_email,
                timestamp: new Date().toISOString(),
                ip: ip,
                userAgent: ua,
                emailClient: mailClient
              };
              io.emit('email:opened', openData);
            }
          }
          
          // Return the tracking pixel
          try {
            const webBug = generateWebBug();
            res.send(webBug);
          } catch (error) {
            console.error('❌ Error generating web bug:', error);
            res.send(TRANSPARENT_PIXEL);
          }
        }
      );
    }
  );
};

// Helper function to detect email client
const detectEmailClient = (userAgent = '') => {
  userAgent = userAgent.toLowerCase();
  
  if (userAgent.includes('thunderbird')) return 'Thunderbird';
  if (userAgent.includes('outlook')) return 'Outlook';
  if (userAgent.includes('apple-mail')) return 'Apple Mail';
  if (userAgent.includes('gmail')) return 'Gmail';
  if (userAgent.includes('protonmail')) return 'ProtonMail';
  if (userAgent.includes('yahoo')) return 'Yahoo Mail';
  
  return 'Unknown';
};

// Get all email opens for a campaign
const getCampaignOpens = (campaignId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT tp.user_email, ol.timestamp, ol.ip, ol.userAgent
       FROM open_logs ol
       JOIN tracking_pixels tp ON ol.pixel_id = tp.id
       WHERE tp.campaign_id = ?
       ORDER BY ol.timestamp DESC`,
      [campaignId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
};

module.exports = {
  logOpen,
  getCampaignOpens,
  generateTrackingUrl
};