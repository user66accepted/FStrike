const express = require('express');

/**
 * Website Mirroring Middleware
 * Handles dynamic website mirroring routes
 */

let websiteMirroringService = null;

// Initialize service
const initService = (service) => {
  websiteMirroringService = service;
};

// CORS Proxy endpoint for handling cross-origin requests
const corsProxyHandler = async (req, res) => {
  try {
    const sessionToken = req.params.sessionToken;
    console.log(`🌐 CORS proxy request for session: ${sessionToken}`);

    if (websiteMirroringService) {
      await websiteMirroringService.handleCrossOriginRequest(req, res, sessionToken);
    } else {
      res.status(500).json({ error: 'Website mirroring service not available' });
    }
  } catch (error) {
    console.error('Error in CORS proxy:', error);
    res.status(500).json({ error: 'CORS proxy failed' });
  }
};

// Website mirroring path-based route handler middleware
const mirroringMiddleware = async (req, res, next) => {
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

    if (!websiteMirroringService) {
      return res.status(500).send(`
        <html>
          <head>
            <title>Service Error</title>
            <style>body{font-family:sans-serif;max-width:600px;margin:40px auto;line-height:1.6}</style>
          </head>
          <body>
            <h2>Service Unavailable</h2>
            <p>Website mirroring service is not available.</p>
          </body>
        </html>
      `);
    }

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
};

module.exports = { corsProxyHandler, mirroringMiddleware, initService };
