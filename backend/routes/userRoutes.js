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
} = require('../controllers/userController');
const { PERMISSIONS } = require('../config/permissions');

// Kullanıcı yönetimi — okuma: super_admin + intern (e-postalar maskeli),
// yazma/onay: sadece super_admin.
router.use(protect);

router.post('/', authorize(...PERMISSIONS.users.write), createUserValidators, handleValidationErrors, createUser);
router.get('/', authorize(...PERMISSIONS.users.read), redactForIntern, getAllUsers);
router.get('/pending', authorize(...PERMISSIONS.users.read), redactForIntern, getPendingUsers);
router.get('/:id', authorize(...PERMISSIONS.users.read), redactForIntern, getUserById);
router.patch('/:id/approve', authorize(...PERMISSIONS.users.approve), approveUserValidators, handleValidationErrors, approveUser);
router.patch('/:id/reject', authorize(...PERMISSIONS.users.approve), rejectUserValidators, handleValidationErrors, rejectUser);
router.patch('/:id/role', authorize(...PERMISSIONS.users.write), updateUserRoleValidators, handleValidationErrors, updateUserRole);
router.patch('/:id/department', authorize(...PERMISSIONS.users.write), updateUserDepartmentValidators, handleValidationErrors, updateUserDepartment);
router.delete('/:id', authorize(...PERMISSIONS.users.write), deleteUser);

module.exports = router;
