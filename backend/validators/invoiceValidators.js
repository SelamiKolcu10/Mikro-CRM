const { body, param } = require('express-validator');

const invoiceIdValidator = [
  param('id').isMongoId().withMessage('Geçersiz fatura ID.'),
];

const createInvoiceValidator = [
  body('customerId').isMongoId().withMessage('Geçersiz müşteri ID.'),
  body('dealId').optional({ nullable: true }).isMongoId().withMessage('Geçersiz fırsat ID.'),
  body('currency').optional().isIn(['TRY', 'USD', 'EUR', 'GBP']).withMessage('Geçersiz para birimi.'),
  body('issueDate').optional({ nullable: true }).isISO8601().toDate().withMessage('Geçersiz fatura tarihi.'),
  body('dueDate').optional({ nullable: true }).isISO8601().toDate().withMessage('Geçersiz vade tarihi.'),
  body('notes').optional().trim().isLength({ max: 2000 }).withMessage('Notlar en fazla 2000 karakter olabilir.'),
  body('paymentNotes').optional().trim().isLength({ max: 1000 }).withMessage('Ödeme notları en fazla 1000 karakter olabilir.'),
  body('items').isArray({ min: 1 }).withMessage('Faturada en az bir kalem bulunmalıdır.'),
  body('items.*.name').trim().notEmpty().withMessage('Kalem adı zorunludur.').isLength({ max: 150 }).withMessage('Kalem adı en fazla 150 karakter olabilir.'),
  body('items.*.description').optional().trim().isLength({ max: 1000 }).withMessage('Açıklama en fazla 1000 karakter olabilir.'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Miktar 0\'dan büyük olmalıdır.'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Birim fiyat negatif olamaz.'),
  body('items.*.taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('KDV oranı %0-100 arasında olmalıdır.'),
  body('items.*.discountRate').optional().isFloat({ min: 0, max: 100 }).withMessage('İndirim oranı %0-100 arasında olmalıdır.'),
];

const updateInvoiceStatusValidator = [
  param('id').isMongoId().withMessage('Geçersiz fatura ID.'),
  body('status').isIn(['draft', 'issued', 'paid', 'overdue', 'cancelled']).withMessage('Geçersiz fatura durumu.'),
  body('paymentNotes').optional().trim().isLength({ max: 1000 }).withMessage('Ödeme notları en fazla 1000 karakter olabilir.'),
];

const updateInvoiceValidator = [
  param('id').isMongoId().withMessage('Geçersiz fatura ID.'),
  body('currency').optional().isIn(['TRY', 'USD', 'EUR', 'GBP']).withMessage('Geçersiz para birimi.'),
  body('issueDate').optional({ nullable: true }).isISO8601().toDate().withMessage('Geçersiz fatura tarihi.'),
  body('dueDate').optional({ nullable: true }).isISO8601().toDate().withMessage('Geçersiz vade tarihi.'),
  body('notes').optional().trim().isLength({ max: 2000 }).withMessage('Notlar en fazla 2000 karakter olabilir.'),
  body('paymentNotes').optional().trim().isLength({ max: 1000 }).withMessage('Ödeme notları en fazla 1000 karakter olabilir.'),
  body('items').isArray({ min: 1 }).withMessage('Faturada en az bir kalem bulunmalıdır.'),
  body('items.*.name').trim().notEmpty().withMessage('Kalem adı zorunludur.').isLength({ max: 150 }).withMessage('Kalem adı en fazla 150 karakter olabilir.'),
  body('items.*.description').optional().trim().isLength({ max: 1000 }).withMessage('Açıklama en fazla 1000 karakter olabilir.'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Miktar 0\'dan büyük olmalıdır.'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Birim fiyat negatif olamaz.'),
  body('items.*.taxRate').optional().isFloat({ min: 0, max: 100 }).withMessage('KDV oranı %0-100 arasında olmalıdır.'),
  body('items.*.discountRate').optional().isFloat({ min: 0, max: 100 }).withMessage('İndirim oranı %0-100 arasında olmalıdır.'),
];

module.exports = {
  invoiceIdValidator,
  createInvoiceValidator,
  updateInvoiceValidator,
  updateInvoiceStatusValidator,
};
