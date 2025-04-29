require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const http = require('http');
const socketIo = require('socket.io');
const ngrokService = require('./services/ngrokService');
const landingPageService = require('./services/landingPageService');

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
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Apply security, CORS, logging, and JSON parsing middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '300mb' }));
app.use(express.urlencoded({ extended: true })); // For parsing form data

// Add detailed request logging for debugging
app.use((req, res, next) => {
  console.log('==================== REQUEST DETAILS ====================');
  console.log(`REQUEST METHOD: ${req.method}`);
  console.log(`REQUEST PATH: ${req.path}`);
  console.log(`REQUEST URL: ${req.url}`);
  console.log(`ORIGINAL URL: ${req.originalUrl}`);
  console.log(`REQUEST HOSTNAME: ${req.hostname}`);
  console.log(`QUERY PARAMS:`, req.query);
  console.log(`HEADERS:`, req.headers);
  console.log('==========================================================');
  next();
});

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
    const db = require('./database'); // Assuming database.js exports a database connection
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

// Tracking pixel endpoint with more debugging
app.get('/tracker/:id.png', (req, res) => {
  console.log('🔍 Tracking pixel requested:', req.params.id);
  console.log('👤 User-Agent:', req.get('User-Agent'));
  console.log('🌐 IP Address:', req.ip);
  
  // Check headers
  console.log('📋 Request headers:', JSON.stringify(req.headers, null, 2));
  
  trackingService.logOpen(req.params.id, req, res, io);
});

// Test tracking pixel endpoint - for testing only
app.get('/test-tracker/:id', (req, res) => {
  const pixelId = req.params.id;
  console.log('📝 Test tracking endpoint called for pixel:', pixelId);
  
  // Redirect to the actual tracking pixel
  res.redirect(`/tracker/${pixelId}.png`);
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

// Initialize ngrok if enabled
const initNgrok = async () => {
  if (config.useNgrok) {
    try {
      console.log('Initializing ngrok...');
      const url = await ngrokService.startTunnel();
      if (url) {
        console.log(`✅ Ngrok tunnel established at: ${url}`);
        console.log(`✅ Tracking URL using ngrok: ${url}/tracker/:id.png`);
      } else {
        console.log('⚠️ Ngrok setup failed, using fallback tracking URL:', config.trackingUrl);
      }
    } catch (error) {
      console.error('⚠️ Failed to start ngrok tunnel:', error);
      console.log('⚠️ Using fallback tracking URL:', config.trackingUrl);
    }
  } else {
    console.log('ℹ️ Ngrok is disabled. Using configured tracking URL:', config.trackingUrl);
  }
};

// Start the server
const PORT = config.port;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
  
  // Initialize ngrok after server starts
  await initNgrok();
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  
  // Close ngrok tunnel if it's open
  if (config.useNgrok) {
    await ngrokService.closeTunnel();
  }
  
  process.exit(0);
});
