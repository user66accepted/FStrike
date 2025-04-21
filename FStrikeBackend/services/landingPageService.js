const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../database');
const ngrokService = require('./ngrokService');
const { v4: uuidv4 } = require('uuid');
const cheerio = require('cheerio');

// Store active landing pages with their routes
const activeLandingPages = new Map();

/**
 * Creates an express router for a specific landing page
 * @param {object} landingPage - The landing page object from the database
 * @param {string} campaignId - The campaign ID
 * @returns {object} - Express router for the landing page
 */
const createLandingPageRouter = (landingPage, campaignId) => {
  const router = express.Router();
  
  // Debug information
  console.log(`Creating router for landing page: ${landingPage.page_name} (ID: ${landingPage.id})`);
  console.log(`HTML content size: ${landingPage.html_content ? landingPage.html_content.length : 0} bytes`);
  
  // Track page loads/link clicks
  router.get('*', (req, res, next) => {
    // Ensure the link_clicks table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='link_clicks'", [], (err, tableExists) => {
      if (err) {
        console.error('Error checking link_clicks table:', err);
        return next(); // Continue with request even if tracking fails
      }
      
      // Create the table if it doesn't exist
      if (!tableExists) {
        console.log('Creating link_clicks table...');
        db.run(`
          CREATE TABLE link_clicks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            landing_page_id INTEGER NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (createErr) => {
          if (createErr) {
            console.error('Error creating link_clicks table:', createErr);
          } else {
            // Log the click now that the table is created
            logClick(campaignId, landingPage.id, req);
          }
          next(); // Continue regardless
        });
      } else {
        // Table exists, log the click
        logClick(campaignId, landingPage.id, req);
        next();
      }
    });
  });
  
  // Serve the main landing page for any path within this router
  router.get('*', (req, res) => {
    console.log(`Serving landing page for campaign ${campaignId} at path: ${req.originalUrl}`);
    
    // Set proper content type for HTML content
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Process the HTML content to add tracking
    const processedHtml = processLandingPageHtml(
      landingPage.html_content, 
      campaignId, 
      landingPage.id,
      ngrokService.getUrl()
    );
    
    // Send the HTML content
    res.send(processedHtml);
  });
  
  // Handle form submissions if captureSubmittedData is enabled
  if (landingPage.capture_submitted_data) {
    router.post('*', (req, res) => {
      // Log the captured data
      const formData = req.body;
      console.log(`Captured form data for campaign ${campaignId}:`, formData);
      
      // Ensure FormSubmissions table exists
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='FormSubmissions'", [], (err, tableExists) => {
        if (err) {
          console.error('Error checking FormSubmissions table:', err);
          return;
        }
        
        // Create the table if it doesn't exist
        if (!tableExists) {
          console.log('Creating FormSubmissions table...');
          db.run(`
            CREATE TABLE FormSubmissions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              campaign_id INTEGER NOT NULL,
              landing_page_id INTEGER NOT NULL,
              form_data TEXT NOT NULL,
              ip_address TEXT,
              user_agent TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (createErr) => {
            if (createErr) {
              console.error('Error creating FormSubmissions table:', createErr);
              return;
            }
            
            // Create FormFields table for individual field tracking
            db.run(`
              CREATE TABLE IF NOT EXISTS FormFields (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER NOT NULL,
                field_name TEXT NOT NULL,
                field_value TEXT,
                FOREIGN KEY (submission_id) REFERENCES FormSubmissions(id) ON DELETE CASCADE
              )
            `, (fieldsErr) => {
              if (fieldsErr) {
                console.error('Error creating FormFields table:', fieldsErr);
                return;
              }
              
              // Now insert the form data
              storeFormSubmission(campaignId, landingPage.id, formData, req);
            });
          });
        } else {
          // Ensure FormFields table exists
          db.run(`
            CREATE TABLE IF NOT EXISTS FormFields (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              submission_id INTEGER NOT NULL,
              field_name TEXT NOT NULL,
              field_value TEXT,
              FOREIGN KEY (submission_id) REFERENCES FormSubmissions(id) ON DELETE CASCADE
            )
          `, (fieldsErr) => {
            if (fieldsErr) {
              console.error('Error creating FormFields table:', fieldsErr);
              return;
            }
            
            // Table exists, insert the form data directly
            storeFormSubmission(campaignId, landingPage.id, formData, req);
          });
        }
      });
      
      // Redirect if specified
      if (landingPage.redirect_url) {
        res.redirect(landingPage.redirect_url);
      } else {
        // Show a simple thank you page
        res.setHeader('Content-Type', 'text/html');
        res.send('<html><body><h1>Thank you for your submission</h1></body></html>');
      }
    });
  }
  
  return router;
};

/**
 * Logs a click on a landing page
 * @param {number} campaignId - The campaign ID
 * @param {number} landingPageId - The landing page ID
 * @param {object} req - Express request object for IP and user agent
 */
const logClick = (campaignId, landingPageId, req) => {
  console.log(`Logging link click for campaign ${campaignId}, landing page ${landingPageId}`);
  
  const query = `
    INSERT INTO link_clicks (campaign_id, landing_page_id, ip_address, user_agent)
    VALUES (?, ?, ?, ?)
  `;
  
  db.run(query, [
    campaignId, 
    landingPageId, 
    req.ip,
    req.headers['user-agent']
  ], (err) => {
    if (err) {
      console.error('Error logging link click:', err);
    } else {
      console.log('Link click logged successfully');
    }
  });
};

/**
 * Stores form submission data in the database
 * @param {number} campaignId - The campaign ID
 * @param {number} landingPageId - The landing page ID
 * @param {object} formData - The form data to store
 * @param {object} req - Express request object for IP and user agent
 */
const storeFormSubmission = (campaignId, landingPageId, formData, req) => {
  // Check if FormFields table has the field_type column
  db.get("PRAGMA table_info(FormFields)", [], (err, rows) => {
    if (err) {
      console.error('Error checking FormFields table schema:', err);
      return;
    }
    
    // If field_type column doesn't exist, add it
    const hasFieldTypeColumn = rows && rows.some(row => row.name === 'field_type');
    if (!hasFieldTypeColumn) {
      db.run("ALTER TABLE FormFields ADD COLUMN field_type TEXT", (alterErr) => {
        if (alterErr) {
          console.error('Error adding field_type column:', alterErr);
        } else {
          console.log('Added field_type column to FormFields table');
        }
      });
    }
  });

  const query = `
    INSERT INTO FormSubmissions (campaign_id, landing_page_id, form_data, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.run(query, [
    campaignId, 
    landingPageId, 
    JSON.stringify(formData),
    req.ip,
    req.headers['user-agent']
  ], function(err) {
    if (err) {
      console.error('Error storing form submission:', err);
    } else {
      console.log('Form submission stored successfully with ID:', this.lastID);
      
      // Insert individual field values
      const submissionId = this.lastID;
      const stmt = db.prepare(`
        INSERT INTO FormFields (submission_id, field_name, field_value, field_type)
        VALUES (?, ?, ?, ?)
      `);
      
      // Extract all form fields
      Object.entries(formData).forEach(([fieldName, fieldValue]) => {
        // Skip internal fields
        if (fieldName.startsWith('_') && 
            ['_originalAction', '_originalMethod', '_campaignId', '_landingPageId'].includes(fieldName)) {
          return;
        }
        
        // Determine field type based on naming convention or value type
        let fieldType = 'text'; // default type
        
        // Try to infer field type from field name
        if (/email/i.test(fieldName)) {
          fieldType = 'email';
        } else if (/password/i.test(fieldName)) {
          fieldType = 'password';
        } else if (/phone/i.test(fieldName)) {
          fieldType = 'tel';
        } else if (/date/i.test(fieldName)) {
          fieldType = 'date';
        } else if (/time/i.test(fieldName)) {
          fieldType = 'time';
        } else if (/checkbox/i.test(fieldName) || (fieldValue === 'on' || fieldValue === 'off')) {
          fieldType = 'checkbox';
        } else if (/radio/i.test(fieldName)) {
          fieldType = 'radio';
        } else if (/select|dropdown/i.test(fieldName)) {
          fieldType = 'select';
        } else if (/text(area)?/i.test(fieldName) || fieldValue && fieldValue.length > 100) {
          fieldType = 'textarea';
        } else if (/number/i.test(fieldName) || /^\d+$/.test(fieldValue)) {
          fieldType = 'number';
        } else if (/file|upload/i.test(fieldName)) {
          fieldType = 'file';
        } else if (/url/i.test(fieldName)) {
          fieldType = 'url';
        }
        
        // Handle array values
        if (Array.isArray(fieldValue)) {
          fieldValue = fieldValue.join(', ');
        }
        
        // Convert to string if not already
        const valueString = String(fieldValue || '');
        
        stmt.run([submissionId, fieldName, valueString, fieldType], (fieldErr) => {
          if (fieldErr) {
            console.error(`Error storing field ${fieldName}:`, fieldErr);
          }
        });
      });
      
      stmt.finalize();
      console.log('Form fields stored successfully');
    }
  });
};

/**
 * Hosts a landing page and returns a public URL
 * @param {number} landingPageId - The ID of the landing page to host
 * @param {number} campaignId - The ID of the campaign
 * @returns {Promise<string>} - Public URL to the hosted landing page
 */
const hostLandingPage = (landingPageId, campaignId) => {
  return new Promise((resolve, reject) => {
    // Get landing page details from database
    db.get('SELECT * FROM LandingPages WHERE id = ?', [landingPageId], async (err, landingPage) => {
      if (err) {
        console.error('Error fetching landing page:', err);
        return reject(err);
      }
      
      if (!landingPage) {
        return reject(new Error('Landing page not found'));
      }
      
      try {
        // Generate a unique path for this landing page instance
        const pageId = uuidv4();
        // IMPORTANT: Use direct UUID as the path (no prefix)
        const pagePath = `/${pageId}`;
        
        console.log(`Created page path: ${pagePath} for landing page ID: ${landingPageId}`);
        
        // Create router for this landing page
        const router = createLandingPageRouter(landingPage, campaignId);
        
        // Store the router with its unique path
        activeLandingPages.set(pagePath, router);
        
        // Get or start ngrok tunnel
        const ngrokUrl = await ngrokService.getUrl();
        if (!ngrokUrl) {
          return reject(new Error('Failed to create ngrok tunnel'));
        }
        
        // Return the full URL to the hosted landing page
        const fullUrl = `${ngrokUrl}${pagePath}`;
        console.log(`Generated landing page URL: ${fullUrl}`);
        
        // Store the URL in the campaign record
        db.run(
          'UPDATE Campaigns SET landing_page_url = ? WHERE id = ?',
          [fullUrl, campaignId],
          (err) => {
            if (err) {
              console.error('Error updating campaign with landing page URL:', err);
            }
          }
        );
        
        resolve(fullUrl);
      } catch (error) {
        reject(error);
      }
    });
  });
};

/**
 * Registers all active landing page routers with the Express app
 * @param {object} app - Express application
 */
const registerLandingPageRoutes = (app) => {
  console.log('Registering landing page routes handler...');
  
  // Mount each router at its specific path
  activeLandingPages.forEach((router, pagePath) => {
    console.log(`Registering landing page route at: ${pagePath}`);
    app.use(pagePath, router);
  });
  
  // Monkey patch the Map.set method to register new routers automatically
  const originalSet = activeLandingPages.set;
  activeLandingPages.set = function(path, router) {
    console.log(`Adding new landing page route to map: ${path}`);
    const result = originalSet.call(this, path, router);
    // Register the new router immediately
    console.log(`Dynamically registering new landing page route at: ${path}`);
    app.use(path, router);
    
    // Print all active routes for debugging
    console.log('Active landing page routes:');
    for (const [path, _] of this.entries()) {
      console.log(`- ${path}`);
    }
    
    return result;
  };
  
  // Add a catch-all route to handle all UUIDs that don't yet have registered routes
  app.use('/:uuid([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', (req, res) => {
    console.log(`UUID handler triggered for ${req.params.uuid}`);
    console.log(`Available paths: ${Array.from(activeLandingPages.keys()).join(', ')}`);
    
    // Check if we have matching routes in our mapping but with different format
    const requestedPath = `/${req.params.uuid}`;
    if (activeLandingPages.has(requestedPath)) {
      console.log(`Found matching landing page router for ${requestedPath}`);
      return activeLandingPages.get(requestedPath)(req, res);
    }
    
    // For debugging - maybe the format is different
    for (const [path, _] of activeLandingPages.entries()) {
      if (path.includes(req.params.uuid)) {
        console.log(`Found UUID ${req.params.uuid} in path ${path} - format mismatch!`);
      }
    }
    
    res.status(404).json({ 
      message: 'Landing page not found',
      requestedPath,
      availablePaths: Array.from(activeLandingPages.keys())
    });
  });
};

/**
 * Replaces links in an email template with the landing page URL
 * @param {string} htmlContent - The email HTML content
 * @param {string} landingPageUrl - The URL to the landing page
 * @returns {string} - Updated HTML content
 */
const injectLandingPageUrl = (htmlContent, landingPageUrl) => {
  console.log(`Injecting landing page URL: ${landingPageUrl} into email template`);
  
  if (!htmlContent) {
    console.error('Email HTML content is empty or undefined');
    return htmlContent || '';
  }
  
  // No need to modify the URL format anymore since we're using direct UUID format
  
  // Replace href attributes in anchor tags
  let updatedHtml = htmlContent.replace(
    /<a\s+(?:[^>]*?\s+)?href=(['"])(.*?)\1/gi,
    (match, quote, url) => {
      // Don't replace email links (mailto:) or anchor links (#)
      if (url.startsWith('mailto:') || url.startsWith('#')) {
        return match;
      }
      console.log(`Replacing link: ${url} with: ${landingPageUrl}`);
      return `<a href=${quote}${landingPageUrl}${quote}`;
    }
  );
  
  // Replace form action attributes
  updatedHtml = updatedHtml.replace(
    /<form\s+(?:[^>]*?\s+)?action=(['"])(.*?)\1/gi,
    (match, quote, url) => {
      console.log(`Replacing form action: ${url} with: ${landingPageUrl}`);
      return `<form action=${quote}${landingPageUrl}${quote}`;
    }
  );
  
  // Replace button onclick attributes that contain URLs or links
  updatedHtml = updatedHtml.replace(
    /<button\s+(?:[^>]*?\s+)?onclick=(['"])(?:.*?location.href=['"]|.*?window.open\(['"])(.*?)(['"])/gi,
    (match, quote1, url, quote2) => {
      console.log(`Replacing button onclick URL: ${url} with: ${landingPageUrl}`);
      return `<button onclick=${quote1}window.location.href='${landingPageUrl}'${quote2}`;
    }
  );
  
  console.log(`HTML update completed, new size: ${updatedHtml.length} bytes`);
  return updatedHtml;
};

/**
 * Get all link clicks for a campaign
 * @param {number} campaignId - The campaign ID
 * @returns {Promise<Array>} - Array of link click data
 */
const getCampaignClicks = (campaignId) => {
  return new Promise((resolve, reject) => {
    // Check if the table exists first
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='link_clicks'", [], (err, tableExists) => {
      if (err) {
        return reject(err);
      }
      
      if (!tableExists) {
        // Return empty array if table doesn't exist yet
        return resolve([]);
      }
      
      // Table exists, get the data
      db.all(
        `SELECT ip_address, user_agent, created_at
         FROM link_clicks
         WHERE campaign_id = ?
         ORDER BY created_at DESC`,
        [campaignId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  });
};

/**
 * Get form submission data for a campaign
 * @param {number} campaignId - The campaign ID
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Number of entries per page
 * @returns {Promise<Object>} - Paginated form submission data
 */
const getCampaignFormSubmissions = (campaignId, page = 1, pageSize = 3) => {
  return new Promise((resolve, reject) => {
    // Check if the table exists first
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='FormSubmissions'", [], (err, tableExists) => {
      if (err) {
        return reject(err);
      }
      
      if (!tableExists) {
        // Return empty array if table doesn't exist yet
        return resolve({
          submissions: [],
          totalCount: 0,
          currentPage: page,
          totalPages: 0
        });
      }
      
      // Calculate offset
      const offset = (page - 1) * pageSize;
      
      // Get total count first
      db.get(
        `SELECT COUNT(*) as count
         FROM FormSubmissions
         WHERE campaign_id = ?`,
        [campaignId],
        (countErr, countRow) => {
          if (countErr) {
            return reject(countErr);
          }
          
          const totalCount = countRow.count;
          const totalPages = Math.ceil(totalCount / pageSize);
          
          // Get paginated submissions
          db.all(
            `SELECT id, campaign_id, landing_page_id, form_data, ip_address, user_agent, created_at
             FROM FormSubmissions
             WHERE campaign_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [campaignId, pageSize, offset],
            (submissionsErr, submissions) => {
              if (submissionsErr) {
                return reject(submissionsErr);
              }
              
              // For each submission, get its fields
              const submissionsWithFields = [];
              let processed = 0;
              
              if (submissions.length === 0) {
                return resolve({
                  submissions: [],
                  totalCount,
                  currentPage: page,
                  totalPages
                });
              }
              
              submissions.forEach(submission => {
                db.all(
                  `SELECT field_name, field_value
                   FROM FormFields
                   WHERE submission_id = ?
                   ORDER BY id ASC`,
                  [submission.id],
                  (fieldsErr, fields) => {
                    if (fieldsErr) {
                      console.error('Error fetching fields:', fieldsErr);
                      fields = [];
                    }
                    
                    // Add fields to submission
                    submissionsWithFields.push({
                      ...submission,
                      fields: fields,
                      timestamp: submission.created_at
                    });
                    
                    processed++;
                    
                    // Return when all submissions have been processed
                    if (processed === submissions.length) {
                      resolve({
                        submissions: submissionsWithFields,
                        totalCount,
                        currentPage: page,
                        totalPages
                      });
                    }
                  }
                );
              });
            }
          );
        }
      );
    });
  });
};

/**
 * Injects tracking URLs and processes the landing page HTML
 * @param {string} html - Original HTML content
 * @param {number} campaignId - Campaign ID
 * @param {number} landingPageId - Landing page ID
 * @param {string} ngrokUrl - The ngrok URL to use for tracking
 * @returns {string} - Processed HTML content
 */
const processLandingPageHtml = (html, campaignId, landingPageId, ngrokUrl) => {
  try {
    // Use cheerio to parse the HTML
    const $ = cheerio.load(html);
    
    // Enable all form elements - remove disabled attribute from all inputs and buttons
    $('input, button, select, textarea').removeAttr('disabled');
    
    // Add click tracking to all links
    $('a').each(function() {
      const href = $(this).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        const trackingUrl = `${ngrokUrl}/track-click/${campaignId}/${landingPageId}?url=${encodeURIComponent(href)}`;
        $(this).attr('href', trackingUrl);
      }
    });
    
    // Modify all forms to submit to our capture endpoint
    $('form').each(function() {
      const originalAction = $(this).attr('action') || '';
      const method = $(this).attr('method') || 'post';
      
      // Set our form action to the current path (will be handled by router.post('*'))
      $(this).attr('action', '');
      $(this).attr('method', 'post');
      
      // Add hidden fields to track original form action and method
      $(this).append(`<input type="hidden" name="_originalAction" value="${originalAction}">`);
      $(this).append(`<input type="hidden" name="_originalMethod" value="${method}">`);
      $(this).append(`<input type="hidden" name="_campaignId" value="${campaignId}">`);
      $(this).append(`<input type="hidden" name="_landingPageId" value="${landingPageId}">`);
    });
    
    // Add hidden tracking pixel
    $('body').append(`<img src="${ngrokUrl}/track-open/${campaignId}/${landingPageId}" style="display:none;" />`);
    
    // Return the modified HTML
    return $.html();
  } catch (error) {
    console.error('Error processing landing page HTML:', error);
    // Return original HTML if there's an error
    return html;
  }
};

module.exports = {
  hostLandingPage,
  registerLandingPageRoutes,
  injectLandingPageUrl,
  storeFormSubmission,
  getCampaignClicks,
  getCampaignFormSubmissions
};
