const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
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

router.post('/', createUser);
router.get('/', getAllUsers);
router.get('/pending', getPendingUsers);
router.get('/:id', getUserById);
router.patch('/:id/approve', approveUser);
router.patch('/:id/reject', rejectUser);
router.patch('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

module.exports = router;
