const { body, param, query } = require('express-validator');
const { MANUAL_ACTIVITY_TYPES } = require('../config/customerEvents');

const PLANS = ['free', 'starter', 'premium', 'vip'];
const SOURCES = ['twitter', 'discord', 'email', 'in-app', 'other'];
// note/email'de içerik zorunlu (asıl kayıt bu); call/meeting'de opsiyonel
// özet (arama/toplantının kendisi loglanır, not eklemek isteğe bağlı).
const NOTE_OPTIONAL_TYPES = ['call', 'meeting'];

const createCustomerValidators = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('İsim 2-100 karakter olmalıdır.').escape(),
  body('email').trim().isEmail().withMessage('Geçerli bir e-posta girin.').normalizeEmail(),
  body('company').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).escape(),
  body('plan').optional().isIn(PLANS).withMessage('Geçersiz plan.'),
  body('mrr').optional().isFloat({ min: 0 }).withMessage('MRR negatif olamaz.'),
  body('source').optional().isIn(SOURCES).withMessage('Geçersiz kaynak.'),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).escape(),
];

// Same rules, but every field is optional since PUT may send a partial body.
const updateCustomerValidators = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('İsim 2-100 karakter olmalıdır.').escape(),
  body('email').optional().trim().isEmail().withMessage('Geçerli bir e-posta girin.').normalizeEmail(),
  body('company').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).escape(),
  body('plan').optional().isIn(PLANS).withMessage('Geçersiz plan.'),
  body('mrr').optional().isFloat({ min: 0 }).withMessage('MRR negatif olamaz.'),
  body('source').optional().isIn(SOURCES).withMessage('Geçersiz kaynak.'),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).escape(),
];

const customerIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz müşteri kimliği.'),
];

const getTimelineValidators = [
  param('id').isMongoId().withMessage('Geçersiz müşteri kimliği.'),
  query('before').optional({ checkFalsy: true }).isISO8601().withMessage('Geçersiz tarih.'),
  query('limit').optional({ checkFalsy: true }).isInt({ min: 1, max: 100 }).withMessage('Geçersiz limit.'),
];

// message/note aynı gerekçeyle .escape() kullanmıyor (bkz. leadValidators.js
// üstteki not — JSX zaten güvenli kaçırır, .escape() personelin kendi yazdığı
// noktalama işaretlerini bozar).
const logActivityValidators = [
  param('id').isMongoId().withMessage('Geçersiz müşteri kimliği.'),
  body('type').isIn(MANUAL_ACTIVITY_TYPES).withMessage('Geçersiz aktivite türü.'),
  body('note')
    .if(body('type').not().isIn(NOTE_OPTIONAL_TYPES))
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Not 1-2000 karakter olmalıdır.'),
  body('note')
    .if(body('type').isIn(NOTE_OPTIONAL_TYPES))
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Not en fazla 2000 karakter olabilir.'),
];

module.exports = {
  createCustomerValidators,
  updateCustomerValidators,
  customerIdValidators,
  getTimelineValidators,
  logActivityValidators,
};
