const { param, body } = require('express-validator');

const publicTokenValidator = [
  param('token').trim().isLength({ min: 10, max: 100 }).withMessage('Geçersiz teklif bağlantısı.'),
];

const rejectQuoteValidator = [
  param('token').trim().isLength({ min: 10, max: 100 }).withMessage('Geçersiz teklif bağlantısı.'),
  body('reason').optional().trim().isLength({ max: 1000 }).withMessage('Red nedeni en fazla 1000 karakter olabilir.'),
];

module.exports = {
  publicTokenValidator,
  rejectQuoteValidator,
};
