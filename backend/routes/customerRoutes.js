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
// Validators run BEFORE authorizeOrQueue so that a request captured into the
// approval queue (override path) is already validated AND .escape()'d — the
// queued payload is later executed verbatim on approval, so it must not skip
// the same input hardening the direct path gets.
router.route('/')
  .get(authorize(...READ_ROLES), getCustomers)
  .post(createCustomerValidators, handleValidationErrors, authorizeOrQueue('customers', 'write', ...WRITE_ROLES), createCustomer);

router.route('/:id')
  .get(authorize(...READ_ROLES), getCustomer)
  .put(updateCustomerValidators, handleValidationErrors, authorizeOrQueue('customers', 'write', ...WRITE_ROLES), updateCustomer)
  .delete(authorizeOrQueue('customers', 'delete', ...WRITE_ROLES), deleteCustomer);

router.post('/:id/portal-access', authorize(...WRITE_ROLES), grantPortalAccess);
router.patch('/:id/portal-access/disable', authorize(...WRITE_ROLES), disablePortalAccess);

module.exports = router;
