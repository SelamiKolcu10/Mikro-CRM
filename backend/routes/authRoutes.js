const express = require('express');
const { login, getMe, changePassword } = require('../controllers/authController');
const { identify } = require('../middleware/identify');
const { authRateLimiter } = require('../middleware/security');
const { handleValidationErrors } = require('../middleware/validate');
const { loginValidators, changePasswordValidators } = require('../validators/authValidators');

const router = express.Router();

// No public registration — accounts are created by a super_admin only
// (see POST /api/users). Single login for both staff and customer-portal
// accounts (see authController.login). Brute-force guard on login; NOT on
// /me, which the frontend calls on every app mount to verify the session.
router.post('/login', authRateLimiter, loginValidators, handleValidationErrors, login);
router.get('/me', identify, getMe);
// Runs behind `identify`, not `protect` — must stay reachable even while
// `protect` is blocking every other internal route (mustChangePassword).
router.patch('/change-password', identify, changePasswordValidators, handleValidationErrors, changePassword);

module.exports = router;
