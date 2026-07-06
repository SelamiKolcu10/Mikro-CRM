const express = require('express');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All customer routes are protected
router.use(protect);

router.route('/').get(getCustomers).post(createCustomer);
router.route('/:id').get(getCustomer).put(updateCustomer).delete(deleteCustomer);

module.exports = router;
