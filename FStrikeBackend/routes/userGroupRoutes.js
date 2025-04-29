const express = require('express');
const router = express.Router();
const userGroupController = require('../controllers/userGroupController');

// User group routes
router.get('/GetUserGroups', userGroupController.getUserGroups);
router.get('/GetGroupUsers/:id', userGroupController.getGroupUsers);
router.post('/SaveUserGroup', userGroupController.saveUserGroup);
router.put('/SaveUserGroup', userGroupController.updateUserGroup);
router.delete('/DeleteUserGroup/:id', userGroupController.deleteUserGroup);

module.exports = router;