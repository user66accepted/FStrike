const ngrok = require('ngrok');
const config = require('../config');

let ngrokUrl = null;

/**
 * Starts an ngrok tunnel to the specified port
 * @returns {Promise<string>} The public ngrok URL
 */
const startTunnel = async () => {
  try {
    // Close any existing tunnel
    if (ngrokUrl) {
      try {
        await ngrok.disconnect();
      } catch (err) {
        console.log('No active tunnel to disconnect');
      }
    }
    
    // Set ngrok auth token if provided
    if (config.ngrokAuthToken) {
      try {
        await ngrok.authtoken(config.ngrokAuthToken);
        console.log('Ngrok authenticated successfully');
      } catch (err) {
        console.error('Failed to authenticate ngrok:', err.message);
        // Continue without auth - might work with limited features
      }
    }
    
    // Start a new tunnel
    console.log(`Starting ngrok tunnel to port ${config.port}...`);
    const url = await ngrok.connect({
      addr: config.port,
      region: config.ngrokRegion || 'us',
    });
    
    console.log(`Ngrok tunnel established at: ${url}`);
    ngrokUrl = url;
    
    return url;
  } catch (error) {
    console.error('Error establishing ngrok tunnel:', error);
    // Don't throw, let fallback mechanism work
    return null;
  }
};

/**
 * Gets the current ngrok URL or starts a new tunnel if needed
 * @returns {Promise<string>} The public ngrok URL or null if failed
 */
const getUrl = async () => {
  if (!ngrokUrl) {
    const url = await startTunnel();
    if (!url) {
      console.log('Using fallback URL instead of ngrok:', config.trackingUrl);
      return config.trackingUrl;
    }
    return url;
  }
  return ngrokUrl;
};

/**
 * Closes the ngrok tunnel
 */
const closeTunnel = async () => {
  if (ngrokUrl) {
    try {
      await ngrok.disconnect();
      ngrokUrl = null;
      console.log('Ngrok tunnel closed');
    } catch (err) {
      console.error('Error closing ngrok tunnel:', err.message);
    }
  }
};

module.exports = {
  startTunnel,
  getUrl,
  closeTunnel
}; 