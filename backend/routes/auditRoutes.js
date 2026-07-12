const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { redactForIntern } = require('../middleware/redactForIntern');
const { getAuditLogs, getAuditLog } = require('../controllers/auditController');
const { PERMISSIONS } = require('../config/permissions');

// Denetim kaydı — okuma: super_admin + intern (aktör e-postası maskeli).
router.use(protect);

router.get('/', authorize(...PERMISSIONS.auditLog.read), redactForIntern, getAuditLogs);
router.get('/:id', authorize(...PERMISSIONS.auditLog.read), redactForIntern, getAuditLog);

module.exports = router;
