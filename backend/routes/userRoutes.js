const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const {
  createUserValidators,
  approveUserValidators,
  updateUserRoleValidators,
  rejectUserValidators,
} = require('../validators/userValidators');
const {
  createUser,
  getAllUsers,
  getPendingUsers,
  getUserById,
  approveUser,
  rejectUser,
  updateUserRole,
  deleteUser,
} = require('../controllers/userController');

// Kullanıcı yönetimi — sadece super_admin
router.use(protect, authorize('super_admin'));

router.post('/', createUserValidators, handleValidationErrors, createUser);
router.get('/', getAllUsers);
router.get('/pending', getPendingUsers);
router.get('/:id', getUserById);
router.patch('/:id/approve', approveUserValidators, handleValidationErrors, approveUser);
router.patch('/:id/reject', rejectUserValidators, handleValidationErrors, rejectUser);
router.patch('/:id/role', updateUserRoleValidators, handleValidationErrors, updateUserRole);
router.delete('/:id', deleteUser);

module.exports = router;
