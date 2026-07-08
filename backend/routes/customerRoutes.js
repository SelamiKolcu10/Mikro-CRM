const express = require('express');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  grantPortalAccess,
  disablePortalAccess,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { ROLES } = require('../config/permissions');

const router = express.Router();

// All customer routes are protected
router.use(protect);

const READ_ROLES = [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN];
const WRITE_ROLES = [ROLES.SUPER_ADMIN, ROLES.STAFF];

router.route('/')
  .get(authorize(...READ_ROLES), getCustomers)
  .post(authorize(...WRITE_ROLES), createCustomer);

router.route('/:id')
  .get(authorize(...READ_ROLES), getCustomer)
  .put(authorize(...WRITE_ROLES), updateCustomer)
  .delete(authorize(...WRITE_ROLES), deleteCustomer);

router.post('/:id/portal-access', authorize(...WRITE_ROLES), grantPortalAccess);
router.patch('/:id/portal-access/disable', authorize(...WRITE_ROLES), disablePortalAccess);

module.exports = router;
