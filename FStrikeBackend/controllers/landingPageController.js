const db = require('../database');

const savePage = (req, res) => {
  const { pageName, htmlContent, captureSubmittedData, redirectTo } = req.body;

  // Validate required fields
  if (!pageName) {
    return res.status(400).json({ error: 'Page name is required.' });
  }

  const query = `
      INSERT INTO LandingPages (page_name, html_content, capture_submitted_data, redirect_url)
      VALUES (?, ?, ?, ?)
  `;
  const values = [pageName, htmlContent, captureSubmittedData ? 1 : 0, captureSubmittedData ? redirectTo : null];

  db.run(query, values, function (err) {
    if (err) {
      console.error('Error saving page:', err.message);
      return res.status(500).json({ error: 'Error saving page.' });
    }
    res.json({ message: 'Page saved successfully!', id: this.lastID });
  });
};

const getLandingPages = (req, res) => {
  const query = `
    SELECT id, page_name, html_content, capture_submitted_data, redirect_url, created_at 
    FROM LandingPages
    ORDER BY created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching landing pages:", err.message);
      return res.status(500).json({ error: "Error fetching landing pages." });
    }
    res.json(rows);
  });
};

const getLandingPage = (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT id, page_name, html_content, capture_submitted_data, redirect_url, created_at 
    FROM LandingPages 
    WHERE id = ?
  `;
  
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error("Error fetching landing page:", err.message);
      return res.status(500).json({ error: "Error fetching landing page." });
    }
    if (!row) {
      return res.status(404).json({ error: "Landing page not found." });
    }
    res.json(row);
  });
};

const updatePage = (req, res) => {
  const { id } = req.params;
  const { pageName, htmlContent, captureSubmittedData, redirectTo } = req.body;

  // Validate required fields
  if (!pageName) {
    return res.status(400).json({ error: 'Page name is required.' });
  }

  const query = `
    UPDATE LandingPages 
    SET page_name = ?, 
        html_content = ?, 
        capture_submitted_data = ?, 
        redirect_url = ?
    WHERE id = ?
  `;
  
  const values = [
    pageName, 
    htmlContent, 
    captureSubmittedData ? 1 : 0, 
    captureSubmittedData ? redirectTo : null,
    id
  ];

  db.run(query, values, function(err) {
    if (err) {
      console.error('Error updating page:', err.message);
      return res.status(500).json({ error: 'Error updating page.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Landing page not found.' });
    }
    res.json({ message: 'Page updated successfully!' });
  });
};

const deleteLandingPage = (req, res) => {
  const { id } = req.params;
  const query = `DELETE FROM LandingPages WHERE id = ?`;

  db.run(query, [id], function (err) {
    if (err) {
      console.error("Error deleting page:", err.message);
      return res.status(500).json({ error: "Error deleting page." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Page not found." });
    }
    res.json({ message: "Page deleted successfully." });
  });
};

module.exports = {
  savePage,
  getLandingPages,
  getLandingPage,
  updatePage,
  deleteLandingPage
};