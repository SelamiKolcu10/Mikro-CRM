const { body } = require('express-validator');

const TYPES = ['bug', 'feature', 'improvement'];
const STATUSES = ['open', 'in-progress', 'resolved', 'closed'];

const createFeedbackValidators = [
  body('title').trim().isLength({ min: 3, max: 150 }).withMessage('Başlık 3-150 karakter olmalıdır.').escape(),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).escape(),
  body('type').isIn(TYPES).withMessage('Geçersiz tür.'),
  body('customer').isMongoId().withMessage('Geçersiz müşteri kaydı.'),
  body('assignedTo').optional({ checkFalsy: true }).isMongoId().withMessage('Geçersiz kullanıcı.'),
];

const updateFeedbackValidators = [
  body('title').optional().trim().isLength({ min: 3, max: 150 }).withMessage('Başlık 3-150 karakter olmalıdır.').escape(),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).escape(),
  body('type').optional().isIn(TYPES).withMessage('Geçersiz tür.'),
  body('status').optional().isIn(STATUSES).withMessage('Geçersiz durum.'),
  body('assignedTo').optional({ checkFalsy: true }).isMongoId().withMessage('Geçersiz kullanıcı.'),
];

module.exports = { createFeedbackValidators, updateFeedbackValidators };
