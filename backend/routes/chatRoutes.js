const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const {
  sendMessageValidators,
  conversationIdValidators,
  assignConversationValidators,
  startConversationValidators,
} = require('../validators/chatValidators');
const { ROLES, PERMISSIONS } = require('../config/permissions');
const {
  getConversations,
  startConversation,
  getMessages,
  sendMessage,
  markRead,
  assignConversation,
} = require('../controllers/chatController');

// Canlı sohbet — super_admin, staff, support (bkz. config/permissions.js)
router.use(protect, authorize(...PERMISSIONS.chat.read));

router.get('/conversations', getConversations);
router.post('/conversations/start', startConversationValidators, handleValidationErrors, startConversation);
router.get('/conversations/:id/messages', conversationIdValidators, handleValidationErrors, getMessages);
router.post('/conversations/:id/messages', conversationIdValidators, sendMessageValidators, handleValidationErrors, sendMessage);
router.patch('/conversations/:id/read', conversationIdValidators, handleValidationErrors, markRead);
router.patch(
  '/conversations/:id/assign',
  authorize(ROLES.SUPER_ADMIN),
  assignConversationValidators,
  handleValidationErrors,
  assignConversation
);

module.exports = router;
