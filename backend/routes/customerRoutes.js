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
const { authorizeOrQueue } = require('../middleware/authorizeOrQueue');
const { handleValidationErrors } = require('../middleware/validate');
const { createCustomerValidators, updateCustomerValidators } = require('../validators/customerValidators');
const { ROLES } = require('../config/permissions');

const router = express.Router();

// All customer routes are protected
router.use(protect);

const READ_ROLES = [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN];
const WRITE_ROLES = [ROLES.SUPER_ADMIN, ROLES.STAFF];

// Mutating routes use authorizeOrQueue instead of authorize: a native
// WRITE_ROLES role passes straight through (identical to before), anyone
// else with a Super Admin-granted PermissionOverride gets queued for
// approval instead of a flat 403 — see middleware/authorizeOrQueue.js.
router.route('/')
  .get(authorize(...READ_ROLES), getCustomers)
  .post(authorizeOrQueue('customers', 'write', ...WRITE_ROLES), createCustomerValidators, handleValidationErrors, createCustomer);

router.route('/:id')
  .get(authorize(...READ_ROLES), getCustomer)
  .put(authorizeOrQueue('customers', 'write', ...WRITE_ROLES), updateCustomerValidators, handleValidationErrors, updateCustomer)
  .delete(authorizeOrQueue('customers', 'delete', ...WRITE_ROLES), deleteCustomer);

router.post('/:id/portal-access', authorize(...WRITE_ROLES), grantPortalAccess);
router.patch('/:id/portal-access/disable', authorize(...WRITE_ROLES), disablePortalAccess);

module.exports = router;
