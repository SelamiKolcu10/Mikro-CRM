const { body, param } = require('express-validator');

// Deliberately NOT using express-validator's .escape() here (unlike other
// free-text fields in this codebase, e.g. feedback description) — chat is
// rendered as plain JSX text, which React already escapes safely against
// XSS. Running .escape() first would HTML-entity-encode quotes/apostrophes
// (e.g. "don't" → "don&#x27;t") and React would then display those literal
// entity characters instead of decoding them, corrupting every message with
// punctuation.
const sendMessageValidators = [
  body('body').trim().isLength({ min: 1, max: 2000 }).withMessage('Mesaj 1-2000 karakter olmalıdır.'),
  // Round-tripped, never persisted — lets the sender's own client reconcile
  // its optimistic bubble with whichever arrives first, the REST response or
  // the socket broadcast of the same message (see hooks/useConversation.js).
  body('clientId').optional().isString().trim().isLength({ max: 100 }),
];

const conversationIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz sohbet kimliği.'),
];

const assignConversationValidators = [
  param('id').isMongoId().withMessage('Geçersiz sohbet kimliği.'),
  body('userId').optional({ nullable: true }).isMongoId().withMessage('Geçersiz kullanıcı kimliği.'),
];

const startConversationValidators = [
  body('customerId').isMongoId().withMessage('Geçersiz müşteri kimliği.'),
];

module.exports = {
  sendMessageValidators,
  conversationIdValidators,
  assignConversationValidators,
  startConversationValidators,
};
