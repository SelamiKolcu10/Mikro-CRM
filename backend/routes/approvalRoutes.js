const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { redactForIntern } = require('../middleware/redactForIntern');
const { rejectApprovalValidators } = require('../validators/approvalValidators');
const { PERMISSIONS } = require('../config/permissions');
const { getApprovals, getMyApprovals, approveRequest, rejectRequest } = require('../controllers/approvalController');

router.use(protect);

// Any authenticated staff user can see their own queued requests.
router.get('/mine', getMyApprovals);

// The full review queue: read opened to intern (e-postalar maskeli), the
// actions themselves (approve/reject) stay super_admin only.
router.get('/', authorize(...PERMISSIONS.approvals.read), redactForIntern, getApprovals);
router.patch('/:id/approve', authorize(...PERMISSIONS.approvals.review), approveRequest);
router.patch('/:id/reject', authorize(...PERMISSIONS.approvals.review), rejectApprovalValidators, handleValidationErrors, rejectRequest);

module.exports = router;
