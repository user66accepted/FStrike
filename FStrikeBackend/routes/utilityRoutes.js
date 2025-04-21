const express = require('express');
const router = express.Router();
const utilityController = require('../controllers/utilityController');
const db = require('../database');

// Utility routes
router.post('/import_email', utilityController.importEmail);
router.post('/extract', utilityController.extract);

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