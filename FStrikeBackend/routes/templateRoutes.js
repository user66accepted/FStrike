const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const templateController = require('../controllers/templateController');

// Email template routes
router.post('/SaveTemplate', upload.array('attachments'), templateController.saveTemplate);
router.get('/GetEmailTemplates', templateController.getEmailTemplates);
router.delete('/DeleteEmailTemplate/:id', templateController.deleteEmailTemplate);

module.exports = router; 