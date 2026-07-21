const { body, param } = require('express-validator');
const { DEAL_STAGES, DEAL_CURRENCIES } = require('../config/deals');

// .escape() bilerek yok — title/lostReason/note panelde düz JSX text olarak
// render edilir, React zaten güvenli kaçış yapar (bkz. leadValidators.js aynı not).

const createDealValidators = [
  body('title').trim().isLength({ min: 2, max: 150 }).withMessage('Başlık 2-150 karakter olmalıdır.'),
  body('customerId').isMongoId().withMessage('Geçersiz müşteri kimliği.'),
  body('value').isFloat({ min: 0 }).withMessage('Tutar 0 veya daha büyük olmalıdır.'),
  body('currency').optional({ checkFalsy: true }).isIn(DEAL_CURRENCIES).withMessage('Geçersiz para birimi.'),
  body('stage').optional({ checkFalsy: true }).isIn(DEAL_STAGES).withMessage('Geçersiz aşama.'),
  body('expectedCloseDate').optional({ checkFalsy: true }).isISO8601().withMessage('Geçersiz tarih.'),
  body('ownerId').optional({ checkFalsy: true }).isMongoId().withMessage('Geçersiz sorumlu kimliği.'),
];

const dealIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz fırsat kimliği.'),
];

const updateDealStageValidators = [
  param('id').isMongoId().withMessage('Geçersiz fırsat kimliği.'),
  body('stage').isIn(DEAL_STAGES).withMessage('Geçersiz aşama.'),
  body('expectedVersion').optional().isInt({ min: 0 }).withMessage('Geçersiz sürüm.'),
  body('lostReason').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Kayıp nedeni en fazla 500 karakter olabilir.'),
];

// PATCH /:id — kısmi güncelleme; tüm alanlar opsiyonel ama gönderilenler geçerli olmalı.
const updateDealValidators = [
  param('id').isMongoId().withMessage('Geçersiz fırsat kimliği.'),
  body('title').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 150 }).withMessage('Başlık 2-150 karakter olmalıdır.'),
  body('value').optional().isFloat({ min: 0 }).withMessage('Tutar 0 veya daha büyük olmalıdır.'),
  body('probability').optional().isInt({ min: 0, max: 100 }).withMessage('Olasılık 0-100 arasında olmalıdır.'),
  body('expectedCloseDate').optional({ checkFalsy: true }).isISO8601().withMessage('Geçersiz tarih.'),
  body('ownerId').optional({ checkFalsy: true }).isMongoId().withMessage('Geçersiz sorumlu kimliği.'),
  body('lostReason').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Kayıp nedeni en fazla 500 karakter olabilir.'),
];

const addDealNoteValidators = [
  param('id').isMongoId().withMessage('Geçersiz fırsat kimliği.'),
  body('note').trim().isLength({ min: 1, max: 1000 }).withMessage('Not 1-1000 karakter olmalıdır.'),
];

module.exports = {
  createDealValidators,
  dealIdValidators,
  updateDealStageValidators,
  updateDealValidators,
  addDealNoteValidators,
};
