const express = require('express');
const { updateProfile, changePassword } = require('../controllers/portalAuthController');
const { getMyFeedbacks, getMyFeedback, createMyFeedback } = require('../controllers/portalFeedbackController');
const { protectPortal } = require('../middleware/portalAuth');

const router = express.Router();

// Login and /me are unified — see POST /api/auth/login and GET /api/auth/me.
router.patch('/auth/password', protectPortal, changePassword);
router.patch('/profile', protectPortal, updateProfile);

router.get('/feedbacks', protectPortal, getMyFeedbacks);
router.get('/feedbacks/:id', protectPortal, getMyFeedback);
router.post('/feedbacks', protectPortal, createMyFeedback);

module.exports = router;
