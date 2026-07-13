const express = require('express');
const { getSpendingSummary, exportSpendingCsv } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { spendingSummaryValidators } = require('../validators/reportValidators');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(protect);

router.get('/spending-summary', authorize(...PERMISSIONS.spendingReport.read), spendingSummaryValidators, handleValidationErrors, getSpendingSummary);
router.get('/spending-export', authorize(...PERMISSIONS.spendingReport.read), spendingSummaryValidators, handleValidationErrors, exportSpendingCsv);

module.exports = router;
