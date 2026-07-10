const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { grantOverrideValidators } = require('../validators/permissionOverrideValidators');
const { ROLES } = require('../config/permissions');
const { getOverrides, grantOverride, revokeOverride } = require('../controllers/permissionOverrideController');

// Managing overrides is itself always super_admin only — no exceptions,
// otherwise a user could grant themselves more access.
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.get('/', getOverrides);
router.post('/', grantOverrideValidators, handleValidationErrors, grantOverride);
router.delete('/:id', revokeOverride);

module.exports = router;
