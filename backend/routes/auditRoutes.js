const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { redactForIntern } = require('../middleware/redactForIntern');
const { getAuditLogs, getAuditLog, getAuditChainStatus, getAuditActors } = require('../controllers/auditController');
const { PERMISSIONS, ROLES } = require('../config/permissions');

// Denetim kaydı — okuma: super_admin + intern (aktör e-postası maskeli).
router.use(protect);

// Static routes before the /:id param route, or Express would treat
// 'verify'/'actors' as an :id value.
router.get('/verify', authorize(...PERMISSIONS.auditLog.read), getAuditChainStatus);
router.get('/actors', authorize(ROLES.SUPER_ADMIN), getAuditActors);

router.get('/', authorize(...PERMISSIONS.auditLog.read), redactForIntern, getAuditLogs);
router.get('/:id', authorize(...PERMISSIONS.auditLog.read), redactForIntern, getAuditLog);

module.exports = router;
