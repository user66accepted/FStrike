const db = require('../database');
const path = require('path');
const { createCanvas } = require('canvas');
const config = require('../config');
const ngrokService = require('./ngrokService');

// Function to generate a 1x1 transparent pixel
const generateWebBug = () => {
  // Create a 1x1 canvas
  const canvas = createCanvas(1, 1);
  const ctx = canvas.getContext('2d');
  
  // Make it transparent
  ctx.clearRect(0, 0, 1, 1);
  
  return canvas.toBuffer('image/png');
};

// Transparent 1x1 pixel as a base64 string for fallback
const TRANSPARENT_PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// Function to generate a tracking URL for a particular email/campaign
const generateTrackingUrl = async (pixelId) => {
  // If ngrok is enabled, use the ngrok URL
  if (config.useNgrok) {
    try {
      const ngrokUrl = await ngrokService.getUrl();
      // ngrokService.getUrl() now returns the fallback URL if ngrok fails
      return `${ngrokUrl}/tracker/${pixelId}.png`;
    } catch (error) {
      console.error('Error getting tracking URL:', error);
      // Fall back to the configured URL if there's still an error
      return `${config.trackingUrl}/tracker/${pixelId}.png`;
    }
  }
  
  // Use the configured tracking URL if ngrok is disabled
  return `${config.trackingUrl}/tracker/${pixelId}.png`;
};

// Handle email open events
const logOpen = async (pixelId, req, res, io) => {
  console.log(`📊 Web bug requested: ${pixelId}`);
  
  // Debug database access
  db.get(`SELECT COUNT(*) as count FROM tracking_pixels`, [], (err, result) => {
    if (err) {
      console.error('❌ Database error checking tracking pixels:', err);
    } else {
      console.log(`ℹ️ Total tracking pixels in database: ${result.count}`);
    }
  });
  
  // 1) Verify pixel exists and get user email
  db.get(
    `SELECT tp.id, tp.user_email, tp.campaign_id, c.name as campaign_name 
     FROM tracking_pixels tp
     JOIN Campaigns c ON tp.campaign_id = c.id
     WHERE tp.id = ?`,
    [pixelId],
    async (err, row) => {
      if (err) {
        console.error('❌ Error verifying pixel:', err);
        // Still return a pixel image to avoid errors in email clients
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return res.send(TRANSPARENT_PIXEL);
      }
      if (!row) {
        console.error('❌ Pixel not found:', pixelId);
        // Check if pixel exists at all
        db.get('SELECT id FROM tracking_pixels WHERE id = ?', [pixelId], (err, result) => {
          if (err) {
            console.error('❌ Error checking if pixel exists:', err);
          } else if (!result) {
            console.error('❌ Pixel definitely does not exist in database');
          } else {
            console.error('⚠️ Pixel exists but joining with Campaigns failed');
          }
        });
        // Still return a pixel image to avoid errors in email clients
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return res.send(TRANSPARENT_PIXEL);
      }

      console.log(`✅ Found tracking pixel for user: ${row.user_email}, campaign: ${row.campaign_name}`);

      // 2) Log the "open"
      const ip = req.ip;
      const ua = req.get('User-Agent');
      db.run(
        `INSERT INTO open_logs (pixel_id, ip, userAgent) VALUES (?, ?, ?)`,
        [pixelId, ip, ua],
        async function(err) {
          if (err) {
            console.error('❌ Error logging open:', err);
            // Still return a pixel image to avoid errors in email clients
            res.set('Content-Type', 'image/png');
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            return res.send(TRANSPARENT_PIXEL);
          }
          
          console.log(`✅ Successfully logged open with ID: ${this.lastID} for pixel: ${pixelId}`);
          
          // Log email opened
          console.log(`📧 Email opened by: ${row.user_email} for campaign: ${row.campaign_name} (ID: ${row.campaign_id})`);
          
          // Emit socket event if io is provided
          if (io) {
            const openData = {
              campaignId: row.campaign_id,
              campaignName: row.campaign_name,
              userEmail: row.user_email,
              timestamp: new Date().toISOString(),
              ip: ip,
              userAgent: ua
            };
            
            io.emit('email:opened', openData);
            console.log('🔔 Emitted email:opened event:', openData);
          } else {
            console.log('⚠️ Socket.io not available, cannot emit real-time event');
          }
          
          try {
            // 3) Generate and return 1x1 transparent pixel
            const webBug = generateWebBug();
            res.set('Content-Type', 'image/png');
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            res.send(webBug);
          } catch (error) {
            console.error('❌ Error generating web bug:', error);
            // Fallback to static transparent pixel
            res.set('Content-Type', 'image/png');
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            res.send(TRANSPARENT_PIXEL);
          }
        }
      );
    }
  );
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