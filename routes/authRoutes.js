const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', authController.registerUser);

// POST /api/auth/login
router.post('/login', authController.loginUser);

// POST /api/auth/change-password
router.post('/change-password', auth, authController.changePassword);

module.exports = router;