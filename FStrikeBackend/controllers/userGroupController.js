const db = require('../database');

const getUserGroups = (req, res, next) => {
  const query = `
    SELECT 
      g.id,
      g.group_name,
      g.created_at,
      COUNT(gu.id) AS memberCount
    FROM UserGroups g
    LEFT JOIN GroupUsers gu ON g.id = gu.group_id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching groups:", err.message);
      return res.status(500).json({ message: "Error fetching groups", error: err.message });
    }
    return res.json({ groups: rows });
  });
};

const getGroupUsers = (req, res, next) => {
  const { id } = req.params;
  const query = `
    SELECT 
      gu.id,
      gu.first_name,
      gu.last_name,
      gu.email,
      gu.position
    FROM GroupUsers gu
    WHERE gu.group_id = ?
    ORDER BY gu.id ASC
  `;

  db.all(query, [id], (err, rows) => {
    if (err) {
      console.error("Error fetching group users:", err.message);
      return res.status(500).json({ message: "Error fetching group users", error: err.message });
    }
    return res.json({ users: rows });
  });
};

const deleteUserGroup = async (req, res, next) => {
  const { id } = req.params;

  try {
    // Delete users associated with the group first
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM GroupUsers WHERE group_id = ?", [id], function (err) {
        if (err) reject(err);
        else resolve();
      });
    });

    // Delete the group itself
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM UserGroups WHERE id = ?", [id], function (err) {
        if (err) reject(err);
        else resolve();
      });
    });

    return res.json({ message: "Group deleted successfully" });
  } catch (err) {
    console.error("Error deleting group:", err.message);
    return res.status(500).json({ message: "Error deleting group", error: err.message });
  }
};

const saveUserGroup = async (req, res, next) => {
  const { groupName, users } = req.body;
  if (!groupName || !users || !Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: 'Group name and at least one user are required.' });
  }

  // Check for duplicate emails in the request
  const emails = users.map(u => u.email);
  const uniqueEmails = new Set(emails);
  if (emails.length !== uniqueEmails.size) {
    return res.status(400).json({ message: 'Duplicate email addresses are not allowed in the same group.' });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    
    // Insert group into UserGroups
    db.run(
      `INSERT INTO UserGroups (group_name) VALUES (?)`,
      [groupName],
      function (err) {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ message: "Error saving group", error: err.message });
        }
        const groupId = this.lastID;

        // Prepare statement for inserting each user into GroupUsers
        const stmt = db.prepare(
          `INSERT INTO GroupUsers (group_id, first_name, last_name, email, position)
           VALUES (?, ?, ?, ?, ?)`
        );

        let insertionError = false;
        for (const user of users) {
          stmt.run(
            [groupId, user.firstName, user.lastName, user.email, user.position],
            function (err) {
              if (err) {
                console.error('Error inserting user:', user.email, err);
                insertionError = true;
              }
            }
          );
        }

        stmt.finalize((err) => {
          if (err || insertionError) {
            db.run("ROLLBACK");
            return res.status(500).json({
              message: "Error saving group users",
              error: err ? err.message : "One or more user inserts failed. This may be due to duplicate email addresses."
            });
          }
          db.run("COMMIT");
          return res.status(200).json({ message: "User group saved successfully" });
        });
      }
    );
  });
};

const updateUserGroup = async (req, res, next) => {
  const { groupId, groupName, users } = req.body;
  if (!groupId || !groupName || !users || !Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: 'Group ID, name and at least one user are required.' });
  }

  // Check for duplicate emails in the request
  const emails = users.map(u => u.email);
  const uniqueEmails = new Set(emails);
  if (emails.length !== uniqueEmails.size) {
    return res.status(400).json({ message: 'Duplicate email addresses are not allowed in the same group.' });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // Update group name
    db.run(
      `UPDATE UserGroups SET group_name = ? WHERE id = ?`,
      [groupName, groupId],
      function (err) {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ message: "Error updating group", error: err.message });
        }

        // Delete existing users
        db.run(
          `DELETE FROM GroupUsers WHERE group_id = ?`,
          [groupId],
          function (err) {
            if (err) {
              db.run("ROLLBACK");
              return res.status(500).json({ message: "Error updating group users", error: err.message });
            }

            // Prepare statement for inserting updated users
            const stmt = db.prepare(
              `INSERT INTO GroupUsers (group_id, first_name, last_name, email, position)
               VALUES (?, ?, ?, ?, ?)`
            );

            let insertionError = false;
            for (const user of users) {
              stmt.run(
                [groupId, user.firstName, user.lastName, user.email, user.position],
                function (err) {
                  if (err) {
                    console.error('Error inserting user:', user.email, err);
                    insertionError = true;
                  }
                }
              );
            }

            stmt.finalize((err) => {
              if (err || insertionError) {
                db.run("ROLLBACK");
                return res.status(500).json({
                  message: "Error updating group users",
                  error: err ? err.message : "One or more user inserts failed. This may be due to duplicate email addresses."
                });
              }
              db.run("COMMIT");
              return res.status(200).json({ message: "User group updated successfully" });
            });
          }
        );
      }
    );
  });
};

module.exports = {
  getUserGroups,
  getGroupUsers,
  deleteUserGroup,
  saveUserGroup,
  updateUserGroup
};