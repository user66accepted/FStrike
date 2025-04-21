const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');

// Fallback JWT secret if not provided in environment
const JWT_SECRET = process.env.JWT_SECRET || 'YourSuperSecretKey123!@#';

const login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { username, password } = req.body;
    const getUserQuery = `
      SELECT id, username, password_hash AS passwordHash
      FROM Users
      WHERE username = ?
    `;
    const user = await new Promise((resolve, reject) => {
      db.get(getUserQuery, [username], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const payload = { id: user.id, username: user.username, role: 'user' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    return res.json({
      message: 'Login successful',
      user: payload,
      token
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login
}; 