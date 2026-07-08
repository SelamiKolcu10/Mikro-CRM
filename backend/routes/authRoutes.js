const express = require('express');
const { login, getMe } = require('../controllers/authController');
const { identify } = require('../middleware/identify');
const { authRateLimiter } = require('../middleware/security');

const router = express.Router();

// No public registration — accounts are created by a super_admin only
// (see POST /api/users). Single login for both staff and customer-portal
// accounts (see authController.login). Brute-force guard on login; NOT on
// /me, which the frontend calls on every app mount to verify the session.
router.post('/login', authRateLimiter, login);
router.get('/me', identify, getMe);

module.exports = router;
