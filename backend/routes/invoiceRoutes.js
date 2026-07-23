const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { PERMISSIONS } = require('../config/permissions');
const {
  invoiceIdValidator,
  createInvoiceValidator,
  updateInvoiceValidator,
  updateInvoiceStatusValidator,
} = require('../validators/invoiceValidators');
const {
  getInvoices,
  createInvoice,
  generateFromQuote,
  getInvoice,
  updateInvoice,
  updateInvoiceStatus,
  getInvoicePdf,
} = require('../controllers/invoiceController');
const {
  issueEInvoice,
  refreshEInvoice,
  getEInvoicePdf,
} = require('../controllers/eInvoiceController');

// Satış Faturaları — ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT
router.get('/', protect, authorize(...PERMISSIONS.invoices.read), getInvoices);
router.post('/', protect, authorize(...PERMISSIONS.invoices.write), createInvoiceValidator, handleValidationErrors, createInvoice);
router.post('/from-quote/:quoteId', protect, authorize(...PERMISSIONS.invoices.write), generateFromQuote);
router.get('/:id', protect, authorize(...PERMISSIONS.invoices.read), invoiceIdValidator, handleValidationErrors, getInvoice);
router.put('/:id', protect, authorize(...PERMISSIONS.invoices.write), updateInvoiceValidator, handleValidationErrors, updateInvoice);
router.patch('/:id/status', protect, authorize(...PERMISSIONS.invoices.write), updateInvoiceStatusValidator, handleValidationErrors, updateInvoiceStatus);
router.get('/:id/pdf', protect, authorize(...PERMISSIONS.invoices.read), invoiceIdValidator, handleValidationErrors, getInvoicePdf);

// ---- Resmî e-Fatura kesimi (GİB entegratörü — sağlayıcı-bağımsız) ----
router.post('/:id/einvoice/issue', protect, authorize(...PERMISSIONS.invoices.write), invoiceIdValidator, handleValidationErrors, issueEInvoice);
router.post('/:id/einvoice/refresh', protect, authorize(...PERMISSIONS.invoices.write), invoiceIdValidator, handleValidationErrors, refreshEInvoice);
router.get('/:id/einvoice/pdf', protect, authorize(...PERMISSIONS.invoices.read), invoiceIdValidator, handleValidationErrors, getEInvoicePdf);

module.exports = router;
