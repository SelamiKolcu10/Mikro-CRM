const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { redactForIntern } = require('../middleware/redactForIntern');
const { handleValidationErrors } = require('../middleware/validate');
const {
  sendMessageValidators,
  conversationIdValidators,
  assignConversationValidators,
  startConversationValidators,
  addNoteValidators,
} = require('../validators/chatValidators');
const { ROLES, PERMISSIONS } = require('../config/permissions');
const {
  getConversations,
  getEscalations,
  startConversation,
  getMessages,
  sendMessage,
  addNote,
  markRead,
  assignConversation,
} = require('../controllers/chatController');

// Canlı sohbet — okuma: super_admin, staff, support, intern (e-postalar
// intern için maskeli). Yazma (mesaj gönderme/başlatma/okundu işaretleme):
// super_admin, staff, support — intern asla mesaj gönderemez.
router.use(protect);

// Before /conversations/:id/* — same permission as the conversation list,
// no new data exposure (escalated conversations are already visible there).
router.get('/escalations', authorize(...PERMISSIONS.chat.read), redactForIntern, getEscalations);

router.get('/conversations', authorize(...PERMISSIONS.chat.read), redactForIntern, getConversations);
router.post('/conversations/start', authorize(...PERMISSIONS.chat.write), startConversationValidators, handleValidationErrors, startConversation);
router.get('/conversations/:id/messages', authorize(...PERMISSIONS.chat.read), redactForIntern, conversationIdValidators, handleValidationErrors, getMessages);
router.post('/conversations/:id/messages', authorize(...PERMISSIONS.chat.write), conversationIdValidators, sendMessageValidators, handleValidationErrors, sendMessage);
// Dahili not — mesaj yazma ile aynı yetki grubu (bkz. chatController.addNote
// dokümantasyonu, güvenlik sınırı orada + portalChatController'da).
router.post('/conversations/:id/notes', authorize(...PERMISSIONS.chat.write), conversationIdValidators, addNoteValidators, handleValidationErrors, addNote);
router.patch('/conversations/:id/read', authorize(...PERMISSIONS.chat.write), conversationIdValidators, handleValidationErrors, markRead);
router.patch(
  '/conversations/:id/assign',
  authorize(ROLES.SUPER_ADMIN),
  assignConversationValidators,
  handleValidationErrors,
  assignConversation
);

module.exports = router;
