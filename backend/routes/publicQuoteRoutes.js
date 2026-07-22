const express = require('express');
const router = express.Router();
const { publicQuoteRateLimiter } = require('../middleware/security');
const { handleValidationErrors } = require('../middleware/validate');
const {
  publicTokenValidator,
  rejectQuoteValidator,
} = require('../validators/publicQuoteValidators');
const {
  getPublicQuote,
  acceptPublicQuote,
  rejectPublicQuote,
} = require('../controllers/publicQuoteController');

// Müşterinin oturum açmadan teklif görüntüleme / kabul / ret işlemleri.
router.use(publicQuoteRateLimiter);

router.get('/:token', publicTokenValidator, handleValidationErrors, getPublicQuote);
router.post('/:token/accept', publicTokenValidator, handleValidationErrors, acceptPublicQuote);
router.post('/:token/reject', rejectQuoteValidator, handleValidationErrors, rejectPublicQuote);

module.exports = router;
