const express = require('express');
const { getSpendingSummary, exportSpendingCsv } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

const router = express.Router();

router.use(protect, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT));

router.get('/spending-summary', getSpendingSummary);
router.get('/spending-export', exportSpendingCsv);

module.exports = router;
