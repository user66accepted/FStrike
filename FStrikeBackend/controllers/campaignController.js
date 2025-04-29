const db = require('../database');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const trackingService = require('../services/trackingService');
const landingPageService = require('../services/landingPageService');
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
    groupId
  } = req.body;

  // Validate required fields
  if (!name || !templateId || !landingPageId || !url || !launchDate || !profileId || !groupId) {
    return res.status(400).json({ error: 'All required fields must be provided.' });
  }

  const query = `
    INSERT INTO Campaigns (
      name, template_id, landing_page_id, url, 
      launch_date, send_by_date, profile_id, group_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    name, templateId, landingPageId, url,
    launchDate, sendByDate, profileId, groupId
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

    // 2. Generate landing page URL for this campaign
    let landingPageUrl;
    try {
      landingPageUrl = await landingPageService.hostLandingPage(campaign.landing_page_id, id);
      console.log(`Generated landing page URL: ${landingPageUrl} for campaign ${id}`);
    } catch (error) {
      console.error('Error generating landing page URL:', error);
      return res.status(500).json({ error: 'Failed to create landing page', details: error.message });
    }

    // 3. Get users from the targeted group
    const users = await new Promise((resolve, reject) => {
      db.all(`SELECT first_name, last_name, email, position FROM GroupUsers WHERE group_id = ?`, [campaign.group_id], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    if (users.length === 0) {
      return res.status(400).json({ error: 'No users found in the target group' });
    }

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
        
        // Add tracking pixel if enabled
        let emailHtml = modifiedEmailHtml.replace(/\{name\}/g, user.first_name || '')
                                       .replace(/\{email\}/g, user.email || '');
        
        // Add tracking web bug if enabled
        if (campaign.add_tracking_image) {
          // Add tracking pixel at the end of the email
          const trackingUrl = await trackingService.generateTrackingUrl(trackingId);
          const webBug = `<img src="${trackingUrl}" alt="" width="1" height="1" border="0" style="height:1px!important;width:1px!important;border-width:0!important;margin-top:0!important;margin-bottom:0!important;margin-right:0!important;margin-left:0!important;padding-top:0!important;padding-bottom:0!important;padding-right:0!important;padding-left:0!important;display:block;" />`;
          emailHtml = `${emailHtml}${webBug}`;
        }

        // Send the email with mail options
        const mailOptions = {
          from: campaign.envelope_sender,
          to: user.email,
          subject: campaign.subject,
          text: personalizedText,
          html: emailHtml, // Use the modified HTML with tracking pixel and landing page URLs
          headers: customHeaders
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        // Log detailed information about the email
        console.log('========== EMAIL SENT DETAILS ==========');
        console.log(`Recipient: ${user.email}`);
        console.log(`Campaign: ${campaign.name} (ID: ${id})`);
        console.log(`Tracking Pixel ID: ${trackingId}`);
        console.log(`Tracking Pixel URL: ${await trackingService.generateTrackingUrl(trackingId)}`);
        console.log(`Landing Page URL: ${landingPageUrl}`);
        console.log('========================================');

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
    
    // 5. Calculate unique statistics
    const uniqueOpenEmails = Array.from(new Set(openedEmails.map(item => item.email)));
    const totalUniqueOpens = uniqueOpenEmails.length;
    
    // Count unique IP addresses for clicks as a proxy for unique users
    const uniqueClickIPs = Array.from(new Set(linkClicks.map(item => item.ip_address)));
    const totalUniqueClicks = uniqueClickIPs.length;

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
        userAgent: open.userAgent
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
        uniqueClicks: totalUniqueClicks
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
  
  try {
    // Verify campaign exists
    const campaign = await new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM Campaigns WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Campaign not found'));
        resolve(row);
      });
    });

    // Get form submissions for this campaign with pagination
    const formData = await landingPageService.getCampaignFormSubmissions(id, page, pageSize);
    
    return res.json({
      campaign: campaign,
      formData: formData
    });
  } catch (err) {
    console.error('Error getting form submissions:', err.message);
    return res.status(500).json({ error: 'Failed to get form submissions', details: err.message });
  }
};

module.exports = {
  saveCampaign,
  getCampaigns,
  deleteCampaign,
  launchCampaign,
  closeCampaign,
  getCampaignLogs,
  getFormSubmissions
};