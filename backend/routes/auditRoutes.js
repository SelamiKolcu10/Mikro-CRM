const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { getAuditLogs, getAuditLog } = require('../controllers/auditController');

// Denetim kaydı — sadece super_admin
router.use(protect, authorize('super_admin'));

router.get('/', getAuditLogs);
router.get('/:id', getAuditLog);

module.exports = router;
