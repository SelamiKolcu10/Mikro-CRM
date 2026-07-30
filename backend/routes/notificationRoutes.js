const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validate');
const { getMyNotifications, markRead, markAllRead } = require('../controllers/notificationController');

// Bildirimler tamamen self-servis: `authorize(...)` YOK, rol kapısı YOK.
// Herkes yalnız kendi bildirimlerine erişir ve bu controller'da recipient
// daima req.user._id'den kurulur — istemciden alınmaz.
router.use(protect);

// '/read-all' statik yol, '/:id/read'den ÖNCE tanımlanmalı; aksi halde
// Express 'read-all'ı :id sanar.
router.patch('/read-all', markAllRead);

router.get('/', getMyNotifications);
router.patch(
  '/:id/read',
  param('id').isMongoId().withMessage('Geçersiz bildirim kimliği.'),
  handleValidationErrors,
  markRead
);

module.exports = router;
