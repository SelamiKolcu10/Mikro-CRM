const express = require('express');
const { getSpendingSummary, exportSpendingCsv } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { spendingSummaryValidators } = require('../validators/reportValidators');
const { ROLES } = require('../config/permissions');

const router = express.Router();

router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT));

router.get('/spending-summary', spendingSummaryValidators, handleValidationErrors, getSpendingSummary);
router.get('/spending-export', spendingSummaryValidators, handleValidationErrors, exportSpendingCsv);

module.exports = router;
