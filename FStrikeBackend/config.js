require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'YourSuperSecretKey123!@#',
  
  // Tracking configuration
  trackingUrl: process.env.PUBLIC_TRACKING_URL || 'http://localhost:5000',
  
  // Ngrok configuration
  useNgrok: process.env.USE_NGROK === 'true' || true,
  ngrokRegion: process.env.NGROK_REGION || 'us',
  ngrokAuthToken: process.env.NGROK_AUTH_TOKEN || ''
};

module.exports = config; 