const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { PERMISSIONS } = require('../config/permissions');
const {
  invoiceIdValidator,
  createInvoiceValidator,
  updateInvoiceStatusValidator,
} = require('../validators/invoiceValidators');
const {
  getInvoices,
  createInvoice,
  generateFromQuote,
  getInvoice,
  updateInvoiceStatus,
  getInvoicePdf,
} = require('../controllers/invoiceController');

// Satış Faturaları — ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT
router.get('/', protect, authorize(...PERMISSIONS.invoices.read), getInvoices);
router.post('/', protect, authorize(...PERMISSIONS.invoices.write), createInvoiceValidator, handleValidationErrors, createInvoice);
router.post('/from-quote/:quoteId', protect, authorize(...PERMISSIONS.invoices.write), generateFromQuote);
router.get('/:id', protect, authorize(...PERMISSIONS.invoices.read), invoiceIdValidator, handleValidationErrors, getInvoice);
router.patch('/:id/status', protect, authorize(...PERMISSIONS.invoices.write), updateInvoiceStatusValidator, handleValidationErrors, updateInvoiceStatus);
router.get('/:id/pdf', protect, authorize(...PERMISSIONS.invoices.read), invoiceIdValidator, handleValidationErrors, getInvoicePdf);

module.exports = router;
