const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { PERMISSIONS } = require('../config/permissions');
const {
  quoteIdValidators,
  createQuoteValidators,
  updateQuoteValidators,
} = require('../validators/quoteValidators');
const {
  getQuotes,
  createQuote,
  getQuote,
  updateQuote,
  sendQuote,
  reviseQuote,
  getQuotePdf,
  getQuoteEvents,
  deleteQuote,
} = require('../controllers/quoteController');

// Teklifler — intern BİLEREK yok (teklif tutarları hassas ciro verisi).
// GÖRÜNTÜLEME (accountant dahil):
router.get('/', protect, authorize(...PERMISSIONS.quotes.read), getQuotes);
router.get('/:id', protect, authorize(...PERMISSIONS.quotes.read), quoteIdValidators, handleValidationErrors, getQuote);
router.get('/:id/pdf', protect, authorize(...PERMISSIONS.quotes.read), quoteIdValidators, handleValidationErrors, getQuotePdf);

// DEĞİŞTİRME (yalnız super_admin + staff):
router.post('/', protect, authorize(...PERMISSIONS.quotes.write), createQuoteValidators, handleValidationErrors, createQuote);
router.patch('/:id', protect, authorize(...PERMISSIONS.quotes.write), updateQuoteValidators, handleValidationErrors, updateQuote);
router.post('/:id/send', protect, authorize(...PERMISSIONS.quotes.write), quoteIdValidators, handleValidationErrors, sendQuote);
router.post('/:id/revise', protect, authorize(...PERMISSIONS.quotes.write), quoteIdValidators, handleValidationErrors, reviseQuote);
router.get('/:id/events', protect, authorize(...PERMISSIONS.quotes.read), quoteIdValidators, handleValidationErrors, getQuoteEvents);
router.delete('/:id', protect, authorize(...PERMISSIONS.quotes.write), quoteIdValidators, handleValidationErrors, deleteQuote);

module.exports = router;
