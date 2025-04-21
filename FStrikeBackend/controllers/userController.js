const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const db = require('../database');

const createUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, password, email } = req.body;

    // Check if username already exists
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM Users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO Users (username, password_hash, email) VALUES (?, ?, ?)',
        [username, passwordHash, email],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });

    return res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createUser
}; 