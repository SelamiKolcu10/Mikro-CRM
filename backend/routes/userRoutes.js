const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { redactForIntern } = require('../middleware/redactForIntern');
const {
  createUserValidators,
  approveUserValidators,
  updateUserRoleValidators,
  rejectUserValidators,
  updateUserDepartmentValidators,
  updateContactInfoValidators,
} = require('../validators/userValidators');
const {
  createUser,
  getAllUsers,
  getPendingUsers,
  getUserById,
  approveUser,
  rejectUser,
  updateUserRole,
  updateUserDepartment,
  deleteUser,
  getMyProfile,
  updateMyContactInfo,
  uploadMyAvatar,
  getUserTree,
} = require('../controllers/userController');
const { uploadAvatar } = require('../middleware/uploadAvatar');
const { verifyAvatarSignature } = require('../middleware/fileSignature');
const { PERMISSIONS } = require('../config/permissions');

// Kullanıcı yönetimi — okuma: super_admin + intern (e-postalar maskeli),
// yazma/onay: sadece super_admin.
router.use(protect);

// Profilim (self-servis) — herkese açık, `users` kaynağı iznine bağlı değil.
// `/:id` route'undan ÖNCE tanımlanmalı yoksa "me" bir ObjectId gibi yakalanır.
router.get('/me/profile', getMyProfile);
router.patch('/me/profile', updateContactInfoValidators, handleValidationErrors, updateMyContactInfo);
router.post('/me/avatar', (req, res, next) => uploadAvatar(req, res, (err) => (err ? res.status(400).json({ success: false, error: err.message }) : next())), verifyAvatarSignature, uploadMyAvatar);

router.post('/', authorize(...PERMISSIONS.users.write), createUserValidators, handleValidationErrors, createUser);
router.get('/', authorize(...PERMISSIONS.users.read), redactForIntern, getAllUsers);
router.get('/pending', authorize(...PERMISSIONS.users.read), redactForIntern, getPendingUsers);
router.get('/:id/tree', getUserTree);
router.get('/:id', authorize(...PERMISSIONS.users.read), redactForIntern, getUserById);
router.patch('/:id/approve', authorize(...PERMISSIONS.users.approve), approveUserValidators, handleValidationErrors, approveUser);
router.patch('/:id/reject', authorize(...PERMISSIONS.users.approve), rejectUserValidators, handleValidationErrors, rejectUser);
router.patch('/:id/role', authorize(...PERMISSIONS.users.write), updateUserRoleValidators, handleValidationErrors, updateUserRole);
router.patch('/:id/department', authorize(...PERMISSIONS.users.write), updateUserDepartmentValidators, handleValidationErrors, updateUserDepartment);
router.delete('/:id', authorize(...PERMISSIONS.users.write), deleteUser);

module.exports = router;
