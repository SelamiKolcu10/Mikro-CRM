const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../middleware/fileSignature');
const { protect, authorize } = require('../middleware/auth');
const {
  uploadSingleInvoice,
  bulkUploadInvoices,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getInvoiceStats,
} = require('../controllers/invoiceController');

// Only super_admin and accountant may touch invoice data
router.use(protect, authorize('super_admin', 'accountant'));

// POST /api/invoices/upload — Single invoice upload + process
router.post('/upload', upload.single('invoice'), verifyFileSignature, uploadSingleInvoice);

// POST /api/invoices/bulk-upload — Bulk invoice upload (10-20 files)
router.post('/bulk-upload', upload.array('invoices', 20), verifyFileSignature, bulkUploadInvoices);

// GET /api/invoices — List all invoices (with pagination & filters)
router.get('/', getAllInvoices);

// GET /api/invoices/stats/summary — Invoice processing statistics
router.get('/stats/summary', getInvoiceStats);

// GET /api/invoices/:id — Single invoice detail
router.get('/:id', getInvoiceById);

// PUT /api/invoices/:id — Manual correction (for mismatch cases)
router.put('/:id', updateInvoice);

// DELETE /api/invoices/:id — Delete invoice
router.delete('/:id', deleteInvoice);

module.exports = router;
