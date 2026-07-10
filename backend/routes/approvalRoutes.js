const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { rejectApprovalValidators } = require('../validators/approvalValidators');
const { ROLES } = require('../config/permissions');
const { getApprovals, getMyApprovals, approveRequest, rejectRequest } = require('../controllers/approvalController');

router.use(protect);

// Any authenticated staff user can see their own queued requests.
router.get('/mine', getMyApprovals);

// The review queue itself and its actions are super_admin only.
router.get('/', authorize(ROLES.SUPER_ADMIN), getApprovals);
router.patch('/:id/approve', authorize(ROLES.SUPER_ADMIN), approveRequest);
router.patch('/:id/reject', authorize(ROLES.SUPER_ADMIN), rejectApprovalValidators, handleValidationErrors, rejectRequest);

module.exports = router;
