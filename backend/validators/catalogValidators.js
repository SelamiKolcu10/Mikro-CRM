const { body, param, query } = require('express-validator');
const { CATALOG_CURRENCIES, PRODUCT_UNITS } = require('../config/catalog');

// .escape() bilerek yok — React güvenli kaçış yapar (bkz. dealValidators.js notu).

const catalogIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz ürün kimliği.'),
];

const createCatalogValidators = [
  body('name').trim().isLength({ min: 1, max: 150 }).withMessage('Ürün adı 1-150 karakter olmalıdır.'),
  body('description').optional({ checkFalsy: true }).isLength({ max: 1000 }).withMessage('Açıklama en fazla 1000 karakter olabilir.'),
  body('sku').optional({ checkFalsy: true }).trim().isLength({ max: 50 }).withMessage('SKU en fazla 50 karakter olabilir.'),
  body('unitPrice').isFloat({ min: 0 }).withMessage('Birim fiyat 0 veya daha büyük olmalıdır.'),
  body('currency').optional({ checkFalsy: true }).isIn(CATALOG_CURRENCIES).withMessage('Geçersiz para birimi.'),
  body('taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('KDV oranı 0-100 arasında olmalıdır.'),
  body('unit').optional({ checkFalsy: true }).isIn(PRODUCT_UNITS).withMessage('Geçersiz birim.'),
  body('category').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Kategori en fazla 100 karakter olabilir.'),
];

const updateCatalogValidators = [
  param('id').isMongoId().withMessage('Geçersiz ürün kimliği.'),
  body('name').optional({ checkFalsy: true }).trim().isLength({ min: 1, max: 150 }).withMessage('Ürün adı 1-150 karakter olmalıdır.'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Açıklama en fazla 1000 karakter olabilir.'),
  body('sku').optional().trim().isLength({ max: 50 }).withMessage('SKU en fazla 50 karakter olabilir.'),
  body('unitPrice').optional().isFloat({ min: 0 }).withMessage('Birim fiyat 0 veya daha büyük olmalıdır.'),
  body('currency').optional({ checkFalsy: true }).isIn(CATALOG_CURRENCIES).withMessage('Geçersiz para birimi.'),
  body('taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('KDV oranı 0-100 arasında olmalıdır.'),
  body('unit').optional({ checkFalsy: true }).isIn(PRODUCT_UNITS).withMessage('Geçersiz birim.'),
  body('category').optional().trim().isLength({ max: 100 }).withMessage('Kategori en fazla 100 karakter olabilir.'),
];

module.exports = {
  catalogIdValidators,
  createCatalogValidators,
  updateCatalogValidators,
};
