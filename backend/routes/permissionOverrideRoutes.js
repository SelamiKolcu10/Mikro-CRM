const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { redactForIntern } = require('../middleware/redactForIntern');
const { grantOverrideValidators } = require('../validators/permissionOverrideValidators');
const { PERMISSIONS } = require('../config/permissions');
const { getOverrides, grantOverride, revokeOverride } = require('../controllers/permissionOverrideController');

router.use(protect);

// Matrisi okumak (kimde hangi override var) intern'a da açık (e-postalar
// maskeli). Grant/revoke etmek her zaman super_admin only kalıyor — aksi
// halde bir kullanıcı kendine yetki verebilirdi.
router.get('/', authorize(...PERMISSIONS.permissionOverrides.read), redactForIntern, getOverrides);
router.post('/', authorize(...PERMISSIONS.permissionOverrides.write), grantOverrideValidators, handleValidationErrors, grantOverride);
router.delete('/:id', authorize(...PERMISSIONS.permissionOverrides.write), revokeOverride);

module.exports = router;
