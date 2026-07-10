const { query } = require('express-validator');

const spendingSummaryValidators = [
  query('dateFrom').optional().isISO8601().withMessage('Geçersiz başlangıç tarihi.'),
  query('dateTo').optional().isISO8601().withMessage('Geçersiz bitiş tarihi.'),
];

module.exports = { spendingSummaryValidators };
