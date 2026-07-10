const express = require('express');
const { updateProfile, changePassword } = require('../controllers/portalAuthController');
const { getMyFeedbacks, getMyFeedback, createMyFeedback } = require('../controllers/portalFeedbackController');
const { getMyMessages, sendMyMessage, markMyRead } = require('../controllers/portalChatController');
const { protectPortal } = require('../middleware/portalAuth');
const { handleValidationErrors } = require('../middleware/validate');
const {
  updateProfileValidators,
  changePasswordValidators,
  createTicketValidators,
} = require('../validators/portalValidators');
const { sendMessageValidators } = require('../validators/chatValidators');

const router = express.Router();

// Login and /me are unified — see POST /api/auth/login and GET /api/auth/me.
router.patch('/auth/password', protectPortal, changePasswordValidators, handleValidationErrors, changePassword);
router.patch('/profile', protectPortal, updateProfileValidators, handleValidationErrors, updateProfile);

router.get('/feedbacks', protectPortal, getMyFeedbacks);
router.get('/feedbacks/:id', protectPortal, getMyFeedback);
router.post('/feedbacks', protectPortal, createTicketValidators, handleValidationErrors, createMyFeedback);

router.get('/chat/messages', protectPortal, getMyMessages);
router.post('/chat/messages', protectPortal, sendMessageValidators, handleValidationErrors, sendMyMessage);
router.patch('/chat/read', protectPortal, markMyRead);

module.exports = router;
