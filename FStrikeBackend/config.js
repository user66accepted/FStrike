require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'YourSuperSecretKey123!@#',
  
  // Tracking configuration
  trackingUrl: process.env.PUBLIC_TRACKING_URL || 'http://cyber-advisory.info:5000',
  
  // Ngrok configuration
  useNgrok: false, // Disable ngrok since we're using VPS
  ngrokRegion: process.env.NGROK_REGION || 'us',
  ngrokAuthToken: process.env.NGROK_AUTH_TOKEN || ''
};

module.exports = config;