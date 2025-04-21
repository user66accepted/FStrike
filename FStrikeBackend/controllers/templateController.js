const db = require('../database');

// Simple email validation function
const isValidEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const saveTemplate = (req, res) => {
  const {
    templateName,
    envelopeSender,
    subject,
    textContent,
    htmlContent,
    addTrackingImage,
    templateId  // Optional: if provided, then we are editing an existing template
  } = req.body;

  // Validate required fields
  if (!templateName || !envelopeSender || !subject || !htmlContent) {
    return res.status(400).json({ message: 'Template name, envelope sender, subject and HTML content are required.' });
  }
  if (!isValidEmail(envelopeSender)) {
    return res.status(400).json({ message: 'Envelope sender must be a valid email.' });
  }

  // Assume a user_id from session or default value (e.g., 1)
  const userId = 1;

  if (templateId) {
    // Editing an existing template.
    // Parse existing attachments from the request. They are sent as JSON strings.
    let existingAttachments = [];
    if (req.body.existingAttachments) {
      if (Array.isArray(req.body.existingAttachments)) {
        existingAttachments = req.body.existingAttachments.map(JSON.parse);
      } else {
        // If only one attachment is provided, it may be a string rather than an array.
        existingAttachments = [JSON.parse(req.body.existingAttachments)];
      }
    }
    // Collect the IDs of attachments to keep
    const keepIds = existingAttachments.map(att => att.id);
    // Build a condition to delete attachments not in keepIds
    const deleteCondition = keepIds.length > 0
      ? `AND id NOT IN (${keepIds.map(() => '?').join(',')})`
      : '';
    const deleteParams = keepIds.length > 0 ? [templateId, ...keepIds] : [templateId];

    const updateTemplateQuery = `
      UPDATE EmailTemplates
      SET template_name = ?,
          envelope_sender = ?,
          subject = ?,
          text = ?,
          html = ?,
          add_tracking_image = ?
      WHERE id = ? AND user_id = ?
    `;
    db.run(
      updateTemplateQuery,
      [
        templateName,
        envelopeSender,
        subject,
        textContent,
        htmlContent,
        addTrackingImage ? 1 : 0,
        templateId,
        userId,
      ],
      function (err) {
        if (err) {
          console.error("Error updating template:", err.message);
          return res.status(500).json({ message: "Error updating template", error: err.message });
        }
        // Delete attachments that are not in the keepIds array.
        const deleteQuery = keepIds.length > 0
          ? `DELETE FROM TemplateAttachments WHERE template_id = ? ${deleteCondition}`
          : `DELETE FROM TemplateAttachments WHERE template_id = ?`;
        db.run(deleteQuery, deleteParams, (delErr) => {
          if (delErr) {
            console.error("Error deleting attachments:", delErr.message);
            // Continue even if deletion of some attachments fails.
          }
          // Insert new attachments from req.files, if any.
          const files = req.files;
          if (files && files.length > 0) {
            const stmt = db.prepare(`
              INSERT INTO TemplateAttachments (template_id, user_id, file_path, original_name)
              VALUES (?, ?, ?, ?)
            `);
            files.forEach(file => {
              stmt.run([templateId, userId, file.path, file.originalname]);
            });
            stmt.finalize();
          }
          return res.json({ message: "Template updated successfully", templateId });
        });
      }
    );
  } else {
    // Inserting a new template
    // Get current date/time in ISO format
    const createdAt = new Date().toISOString();
    const insertTemplateQuery = `
      INSERT INTO EmailTemplates 
        (user_id, template_name, envelope_sender, subject, text, html, add_tracking_image, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(
      insertTemplateQuery,
      [userId, templateName, envelopeSender, subject, textContent, htmlContent, addTrackingImage ? 1 : 0, createdAt],
      function (err) {
        if (err) {
          console.error("Error inserting template:", err.message);
          return res.status(500).json({ message: "Error saving template", error: err.message });
        }
        const newTemplateId = this.lastID;
        // If there are attached files, insert them into TemplateAttachments table
        const files = req.files;
        if (files && files.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO TemplateAttachments (template_id, user_id, file_path, original_name)
            VALUES (?, ?, ?, ?)
          `);
          files.forEach(file => {
            stmt.run([newTemplateId, userId, file.path, file.originalname]);
          });
          stmt.finalize();
        }
        return res.json({ message: "Template saved successfully", templateId: newTemplateId });
      }
    );
  }
};

const getEmailTemplates = (req, res) => {
  const query = `
    SELECT 
      t.id,
      t.template_name,
      t.envelope_sender,
      t.subject,
      t.text,
      t.html,
      t.add_tracking_image,
      t.created_at,
      a.id as attachment_id,
      a.file_path,
      a.original_name
    FROM EmailTemplates t
    LEFT JOIN TemplateAttachments a ON t.id = a.template_id
    ORDER BY t.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching templates:", err.message);
      return res.status(500).json({ message: "Error fetching templates", error: err.message });
    }
    // Group rows by template id
    const templatesMap = {};
    rows.forEach(row => {
      if (!templatesMap[row.id]) {
        templatesMap[row.id] = {
          id: row.id,
          template_name: row.template_name,
          envelope_sender: row.envelope_sender,
          subject: row.subject,
          text: row.text,
          html: row.html,
          add_tracking_image: row.add_tracking_image,
          created_at: row.created_at,
          attachments: []
        };
      }
      if (row.attachment_id) {
        templatesMap[row.id].attachments.push({
          id: row.attachment_id,
          file_path: row.file_path,
          original_name: row.original_name
        });
      }
    });
    const templates = Object.values(templatesMap);
    return res.json({ templates });
  });
};

const deleteEmailTemplate = (req, res) => {
  const templateId = req.params.id;
  // Delete attached files first
  db.run(`DELETE FROM TemplateAttachments WHERE template_id = ?`, [templateId], function (err) {
    if (err) {
      console.error("Error deleting template attachments:", err.message);
      return res.status(500).json({ message: "Error deleting template attachments", error: err.message });
    }
    // Now delete the template
    db.run(`DELETE FROM EmailTemplates WHERE id = ?`, [templateId], function (err) {
      if (err) {
        console.error("Error deleting template:", err.message);
        return res.status(500).json({ message: "Error deleting template", error: err.message });
      }
      return res.json({ message: "Template deleted successfully." });
    });
  });
};

module.exports = {
  saveTemplate,
  getEmailTemplates,
  deleteEmailTemplate
}; 