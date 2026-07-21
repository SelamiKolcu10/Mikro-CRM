const { body, param } = require('express-validator');
const { LEAD_TYPES, BUDGET_RANGES, TIMEFRAMES, LEAD_STATUSES } = require('../config/leads');

// Deliberately NOT using express-validator's .escape() here — same rationale
// as validators/taskValidators.js: name/company/message render as plain JSX
// text in the panel, React already escapes that safely. Running .escape()
// first would HTML-entity-encode punctuation and show staff literal "&amp;"
// characters instead of the customer's actual words.
const createLeadValidators = [
  body('type').isIn(LEAD_TYPES).withMessage('Geçersiz talep türü.'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Ad soyad 2-100 karakter olmalıdır.'),
  body('email').trim().isEmail().withMessage('Geçerli bir e-posta girin.').normalizeEmail({ gmail_remove_dots: false }),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }).withMessage('Telefon en fazla 30 karakter olabilir.'),
  body('company').optional({ checkFalsy: true }).trim().isLength({ max: 120 }).withMessage('Şirket adı en fazla 120 karakter olabilir.'),
  // Sadece type='quote' formda görünüyor ama sunucu her ihtimalde gevşek
  // doğrular (boşsa sorun değil, doluysa geçerli bir değer olmalı) — form
  // dışından/manipüle edilmiş bir istekte de enum dışı veri giremesin diye.
  body('budgetRange').optional({ checkFalsy: true }).isIn(BUDGET_RANGES).withMessage('Geçersiz bütçe aralığı.'),
  body('timeframe').optional({ checkFalsy: true }).isIn(TIMEFRAMES).withMessage('Geçersiz zaman aralığı.'),
  body('message').trim().isLength({ min: 10, max: 4000 }).withMessage('Talep metni 10-4000 karakter olmalıdır.'),
  // KVKK onayı olmadan kayıt hiç oluşmaz (bkz. Lead.kvkkConsentAt: required).
  body('kvkkConsent').custom((v) => v === true).withMessage('Kişisel verilerin işlenmesini onaylamanız gerekiyor.'),
];

const leadIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz talep kimliği.'),
];

const updateLeadStatusValidators = [
  param('id').isMongoId().withMessage('Geçersiz talep kimliği.'),
  body('status').isIn(LEAD_STATUSES).withMessage('Geçersiz durum.'),
];

// message/note aynı gerekçeyle .escape() kullanmıyor (bkz. yukarıdaki not).
const addLeadNoteValidators = [
  param('id').isMongoId().withMessage('Geçersiz talep kimliği.'),
  body('note').trim().isLength({ min: 1, max: 1000 }).withMessage('Not 1-1000 karakter olmalıdır.'),
];

module.exports = { createLeadValidators, leadIdValidators, updateLeadStatusValidators, addLeadNoteValidators };
