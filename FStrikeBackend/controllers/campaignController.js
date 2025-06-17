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

        // Add tracking web bug if enabled
        let finalHtmlContent = modifiedEmailHtml;
        if (campaign.add_tracking_image) {
          // Create single tracking pixel for better accuracy
          const webBug = `
            <!-- Mail tracking -->
            <div style="line-height:0;font-size:0;height:0">
              <img src="https://ananthtech.ddns.net/tracker/${trackingId}.png?t=${Date.now()}" 
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
    // 1. Verify campaign exists
    const campaign = await new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM Campaigns WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Campaign not found'));
        resolve(row);
      });
    });

    // 2. Get all tracking pixels for this campaign (sent emails)
    const sentEmails = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, user_email, createdAt 
         FROM tracking_pixels
         WHERE campaign_id = ?
         ORDER BY createdAt DESC`,
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // 3. Get all opens for this campaign
    const openedEmails = await trackingService.getCampaignOpens(id);
    
    // 4. Get all link clicks for this campaign
    const linkClicks = await landingPageService.getCampaignClicks(id);
    
    // 5. Calculate unique statistics and identify spam opens
    const uniqueOpenEmails = Array.from(new Set(openedEmails.map(item => item.email)));
    const totalUniqueOpens = uniqueOpenEmails.length;
    
    const uniqueClickIPs = Array.from(new Set(linkClicks.map(item => item.ip_address)));
    const totalUniqueClicks = uniqueClickIPs.length;

    // Calculate spam opens (opens within 5 seconds)
    const spamOpens = openedEmails.filter(open => {
      const sentEmail = sentEmails.find(sent => sent.user_email === open.user_email);
      if (!sentEmail) return false;
      
      const timeDiff = new Date(open.timestamp) - new Date(sentEmail.createdAt);
      return timeDiff <= 5000; // 5 seconds in milliseconds
    });

    // Calculate legitimate opens
    const legitimateOpens = openedEmails.length - spamOpens.length;
    
    // Calculate percentages
    const legitimateOpenPercentage = openedEmails.length > 0 ? (legitimateOpens / openedEmails.length) * 100 : 0;
    const spamOpenPercentage = openedEmails.length > 0 ? (spamOpens.length / openedEmails.length) * 100 : 0;

    return res.json({
      campaign: campaign,
      sent: sentEmails.map(email => ({
        email: email.user_email,
        sentAt: email.createdAt
      })),
      opened: openedEmails.map(open => ({
        email: open.user_email,
        openedAt: open.timestamp,
        ip: open.ip,
        userAgent: open.userAgent,
        isSpam: spamOpens.some(spam => 
          spam.user_email === open.user_email && 
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
  trackMirrorView
};