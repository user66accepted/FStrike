const express = require('express');
const router = express.Router();
const userGroupController = require('../controllers/userGroupController');

// User group routes
router.get('/GetUserGroups', userGroupController.getUserGroups);
router.post('/SaveUserGroup', userGroupController.saveUserGroup);
router.delete('/DeleteUserGroup/:id', userGroupController.deleteUserGroup);

module.exports = router; 