const db = require('../database');

// Simple email validation function
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const saveProfile = (req, res) => {
  const {
    name,
    from,
    host,
    username,
    password,
    ignoreCertErrors,
    headers
  } = req.body;

  // Basic validation
  if (!name || !from || !host || !username || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailMatch = from.match(/<([^>]+)>/);
  const extractedEmail = emailMatch ? emailMatch[1] : from;
  if (!emailRegex.test(extractedEmail)) {
    return res.status(400).json({ error: 'Invalid "From" email format.' });
  }

  // Insert into SendingProfiles
  const insertProfileQuery = `
    INSERT INTO SendingProfiles (name, from_address, host, username, password, ignore_cert_errors)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(insertProfileQuery, [name, from, host, username, password, ignoreCertErrors ? 1 : 0], function (err) {
    if (err) {
      console.error('Error inserting profile:', err.message);
      return res.status(500).json({ error: 'Failed to save profile.' });
    }

    const profileId = this.lastID;

    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      return res.status(200).json({ success: true, profileId });
    }

    const insertHeaderQuery = `
      INSERT INTO ProfileHeaders (profile_id, header_key, header_value)
      VALUES (?, ?, ?)
    `;

    const stmt = db.prepare(insertHeaderQuery);
    for (const header of headers) {
      if (!header.key || !header.value) continue;
      stmt.run([profileId, header.key, header.value]);
    }
    stmt.finalize();

    return res.status(200).json({ success: true, profileId });
  });
};

const getProfiles = (req, res) => {
  const query = `
    SELECT
      id                     AS profileId,
      name,
      from_address           AS fromAddress,
      host,
      username,
      ignore_cert_errors     AS ignoreCertErrors,
      created_at             AS createdAt
    FROM SendingProfiles
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching profiles:', err.message);
      return res.status(500).json({ error: 'Failed to fetch profiles.' });
    }
    res.json({ profiles: rows });
  });
};

const updateProfile = (req, res) => {
  const { id } = req.params;
  const {
    name,
    from,
    host,
    username,
    password,
    ignoreCertErrors,
    headers
  } = req.body;

  // Basic validation
  if (!name || !from || !host || !username || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailMatch = from.match(/<([^>]+)>/);
  const extractedEmail = emailMatch ? emailMatch[1] : from;
  if (!emailRegex.test(extractedEmail)) {
    return res.status(400).json({ error: 'Invalid "From" email format.' });
  }

  // 1) Update the main profile row
  const updateProfileQuery = `
    UPDATE SendingProfiles
    SET name             = ?,
        from_address     = ?,
        host             = ?,
        username         = ?,
        password         = ?,
        ignore_cert_errors = ?
    WHERE id = ?
  `;

  db.run(
    updateProfileQuery,
    [name, from, host, username, password, ignoreCertErrors ? 1 : 0, id],
    function (err) {
      if (err) {
        console.error('Error updating profile:', err.message);
        return res.status(500).json({ error: 'Failed to update profile.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Profile not found.' });
      }

      // 2) Delete old headers (cascade would do this too, but we want to re‑insert)
      db.run(
        `DELETE FROM ProfileHeaders WHERE profile_id = ?`,
        [id],
        function (err2) {
          if (err2) {
            console.error('Error deleting old headers:', err2.message);
            return res.status(500).json({ error: 'Failed to clear old headers.' });
          }

          // 3) Insert new headers (if any)
          if (Array.isArray(headers) && headers.length > 0) {
            const insertHeaderQuery = `
              INSERT INTO ProfileHeaders (profile_id, header_key, header_value)
              VALUES (?, ?, ?)
            `;
            const stmt = db.prepare(insertHeaderQuery);
            for (const h of headers) {
              if (!h.key || !h.value) continue;
              stmt.run([id, h.key, h.value]);
            }
            stmt.finalize((err3) => {
              if (err3) {
                console.error('Error inserting headers:', err3.message);
                return res.status(500).json({ error: 'Failed to save headers.' });
              }
              res.json({ success: true });
            });
          } else {
            // No headers to insert
            res.json({ success: true });
          }
        }
      );
    }
  );
};

const getProfile = (req, res) => {
  const { id } = req.params;

  // 1) fetch the profile
  db.get(
    `SELECT 
       id           AS profileId,
       name,
       from_address AS fromAddress,
       host,
       username,
       password,
       ignore_cert_errors AS ignoreCertErrors
     FROM SendingProfiles
     WHERE id = ?`,
    [id],
    (err, profile) => {
      if (err) {
        console.error('Error fetching profile:', err.message);
        return res.status(500).json({ error: 'Failed to fetch profile.' });
      }
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found.' });
      }

      // 2) fetch its headers
      db.all(
        `SELECT header_key AS key, header_value AS value
         FROM ProfileHeaders
         WHERE profile_id = ?`,
        [id],
        (err2, headers) => {
          if (err2) {
            console.error('Error fetching headers:', err2.message);
            return res.status(500).json({ error: 'Failed to fetch headers.' });
          }
          res.json({ profile, headers });
        }
      );
    }
  );
};

const deleteProfile = (req, res) => {
  const { id } = req.params;

  // First delete any headers
  db.run(
    `DELETE FROM ProfileHeaders WHERE profile_id = ?`,
    [id],
    function (err) {
      if (err) {
        console.error('Error deleting headers:', err.message);
        return res.status(500).json({ error: 'Failed to delete profile headers.' });
      }

      // Then delete the profile itself
      db.run(
        `DELETE FROM SendingProfiles WHERE id = ?`,
        [id],
        function (err2) {
          if (err2) {
            console.error('Error deleting profile:', err2.message);
            return res.status(500).json({ error: 'Failed to delete profile.' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Profile not found.' });
          }
          res.json({ success: true });
        }
      );
    }
  );
};

module.exports = {
  saveProfile,
  getProfiles,
  updateProfile,
  getProfile,
  deleteProfile
}; 