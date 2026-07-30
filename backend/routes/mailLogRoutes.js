const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validate');
const { ROLES } = require('../config/permissions');
const { getMailLogs, getMailLog } = require('../controllers/mailLogController');

// Giden mail kayıtları YALNIZ super_admin'e açık: gövdede kişiye özel metinler
// var (görev başlıkları, onay gerekçeleri) ve alıcı adresleri görünüyor.
// Denetim kaydından farklı olarak intern'e de açılmadı.
router.use(protect, authorize(ROLES.SUPER_ADMIN));

router.get('/', getMailLogs);
router.get(
  '/:id',
  param('id').isMongoId().withMessage('Geçersiz kayıt kimliği.'),
  handleValidationErrors,
  getMailLog
);

module.exports = router;
