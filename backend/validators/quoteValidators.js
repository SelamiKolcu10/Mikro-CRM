const { body, param } = require('express-validator');
const { QUOTE_STATUSES } = require('../config/quotes');
const { CATALOG_CURRENCIES } = require('../config/catalog');

// .escape() bilerek yok — React güvenli kaçış yapar (bkz. dealValidators.js notu).

const quoteIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz teklif kimliği.'),
];

const createQuoteValidators = [
  body('customerId').isMongoId().withMessage('Geçersiz müşteri kimliği.'),
  body('dealId').optional({ checkFalsy: true }).isMongoId().withMessage('Geçersiz fırsat kimliği.'),
  body('currency').optional({ checkFalsy: true }).isIn(CATALOG_CURRENCIES).withMessage('Geçersiz para birimi.'),
  body('validUntil').optional({ checkFalsy: true }).isISO8601().withMessage('Geçersiz tarih.'),
  body('notes').optional({ checkFalsy: true }).isLength({ max: 2000 }).withMessage('Notlar en fazla 2000 karakter olabilir.'),
  body('items').isArray({ min: 1 }).withMessage('En az bir kalem eklenmelidir.'),
  body('items.*.name').trim().isLength({ min: 1, max: 150 }).withMessage('Kalem adı 1-150 karakter olmalıdır.'),
  body('items.*.quantity').isFloat({ min: 0 }).withMessage('Miktar 0 veya daha büyük olmalıdır.'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Birim fiyat 0 veya daha büyük olmalıdır.'),
  body('items.*.taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('KDV oranı 0-100 arasında olmalıdır.'),
  body('items.*.discountRate').optional().isFloat({ min: 0, max: 100 }).withMessage('İndirim oranı 0-100 arasında olmalıdır.'),
  body('items.*.productId').optional({ checkFalsy: true }).isMongoId().withMessage('Geçersiz ürün kimliği.'),
];

const updateQuoteValidators = [
  param('id').isMongoId().withMessage('Geçersiz teklif kimliği.'),
  body('customerId').optional({ checkFalsy: true }).isMongoId().withMessage('Geçersiz müşteri kimliği.'),
  body('dealId').optional({ nullable: true }).custom((v) => {
    if (v === null || v === '') return true;
    return /^[0-9a-fA-F]{24}$/.test(v);
  }).withMessage('Geçersiz fırsat kimliği.'),
  body('currency').optional({ checkFalsy: true }).isIn(CATALOG_CURRENCIES).withMessage('Geçersiz para birimi.'),
  body('validUntil').optional({ nullable: true }).custom((v) => {
    if (v === null || v === '') return true;
    return !isNaN(Date.parse(v));
  }).withMessage('Geçersiz tarih.'),
  body('notes').optional().isLength({ max: 2000 }).withMessage('Notlar en fazla 2000 karakter olabilir.'),
  body('items').optional().isArray({ min: 1 }).withMessage('En az bir kalem eklenmelidir.'),
  body('items.*.name').optional().trim().isLength({ min: 1, max: 150 }).withMessage('Kalem adı 1-150 karakter olmalıdır.'),
  body('items.*.quantity').optional().isFloat({ min: 0 }).withMessage('Miktar 0 veya daha büyük olmalıdır.'),
  body('items.*.unitPrice').optional().isFloat({ min: 0 }).withMessage('Birim fiyat 0 veya daha büyük olmalıdır.'),
  body('items.*.taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('KDV oranı 0-100 arasında olmalıdır.'),
  body('items.*.discountRate').optional().isFloat({ min: 0, max: 100 }).withMessage('İndirim oranı 0-100 arasında olmalıdır.'),
];

module.exports = {
  quoteIdValidators,
  createQuoteValidators,
  updateQuoteValidators,
};
