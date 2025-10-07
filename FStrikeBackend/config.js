require('dotenv').config();

const config = {
  port: process.env.PORT || 5001, // Changed from 5000 to 5001
  jwtSecret: process.env.JWT_SECRET || 'YourSuperSecretKey123!@#',
  
  // Tracking configuration - force HTTP
  trackingUrl: 'https://rivertime.ddns.net',
  
  // Ngrok configuration
  useNgrok: false, // Disable ngrok since we're using VPS
  ngrokRegion: process.env.NGROK_REGION || 'us',
  ngrokAuthToken: process.env.NGROK_AUTH_TOKEN || ''
};

module.exports = config;