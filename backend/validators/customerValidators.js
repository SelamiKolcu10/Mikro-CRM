const { body } = require('express-validator');

const PLANS = ['free', 'starter', 'premium', 'vip'];
const SOURCES = ['twitter', 'discord', 'email', 'in-app', 'other'];

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

module.exports = { createCustomerValidators, updateCustomerValidators };
