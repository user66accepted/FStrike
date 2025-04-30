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
  
  return canvas.toBuffer('image/png');
};

// Transparent 1x1 pixel as a base64 string for fallback
const TRANSPARENT_PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// Function to generate a tracking URL for a particular email/campaign
const generateTrackingUrl = async (pixelId) => {
  return `${config.trackingUrl}/tracker/${pixelId}.png?t=${Date.now()}`;
};

// Handle email open events
const logOpen = async (pixelId, req, res, io) => {
  console.log(`📊 Web bug requested: ${pixelId}`);
  console.log(`📋 Request headers:`, JSON.stringify(req.headers, null, 2));
  
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const ua = req.get('User-Agent');

  // 1) Verify pixel exists and get user email
  db.get(
    `SELECT tp.id, tp.user_email, tp.campaign_id, c.name as campaign_name 
     FROM tracking_pixels tp
     JOIN Campaigns c ON tp.campaign_id = c.id
     WHERE tp.id = ?`,
    [pixelId],
    async (err, row) => {
      if (err || !row) {
        console.error('❌ Error verifying pixel:', err);
        // Always return a pixel image even on error
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        return res.send(TRANSPARENT_PIXEL);
      }

      console.log(`✅ Found tracking pixel for user: ${row.user_email}, campaign: ${row.campaign_name}`);

      // Check if this email has already opened this campaign (without considering IP)
      db.get(
        `SELECT COUNT(*) as count
         FROM open_logs ol
         JOIN tracking_pixels tp ON ol.pixel_id = tp.id
         WHERE tp.user_email = ? AND tp.campaign_id = ?`,
        [row.user_email, row.campaign_id],
        (countErr, countRow) => {
          if (!countErr && countRow.count === 0) {
            // This is a unique open for this email, log it
            db.run(
              `INSERT INTO open_logs (pixel_id, ip, userAgent) VALUES (?, ?, ?)`,
              [pixelId, ip, ua],
              async function(err) {
                if (err) {
                  console.error('❌ Error logging open:', err);
                } else {
                  console.log(`✅ Successfully logged unique open with ID: ${this.lastID} for pixel: ${pixelId}`);
                  
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
                  }
                }
                
                // Return the tracking pixel
                try {
                  const webBug = generateWebBug();
                  res.set('Content-Type', 'image/png');
                  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                  res.set('Pragma', 'no-cache');
                  res.set('Expires', '0');
                  res.set('Last-Modified', (new Date()).toUTCString());
                  res.send(webBug);
                } catch (error) {
                  console.error('❌ Error generating web bug:', error);
                  res.send(TRANSPARENT_PIXEL);
                }
              }
            );
          } else {
            // Not a unique open, just return the pixel
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