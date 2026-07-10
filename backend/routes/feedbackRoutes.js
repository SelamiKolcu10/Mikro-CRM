const express = require('express');
const {
  getFeedbacks,
  getFeedback,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getStats,
} = require('../controllers/feedbackController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { authorizeOrQueue } = require('../middleware/authorizeOrQueue');
const { handleValidationErrors } = require('../middleware/validate');
const { createFeedbackValidators, updateFeedbackValidators } = require('../validators/feedbackValidators');
const { ROLES } = require('../config/permissions');

const router = express.Router();

// All feedback routes are protected
router.use(protect);

const READ_ROLES = [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.STAFF, ROLES.SUPPORT, ROLES.INTERN];
const WRITE_ROLES = [ROLES.SUPER_ADMIN, ROLES.STAFF];
// Support handles tickets day-to-day (status/assignment updates) but can't
// create or delete feedback entries — that stays with staff/super_admin.
const UPDATE_ROLES = [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.SUPPORT];

// Stats route must come before /:id to avoid matching "stats" as an ID
router.get('/stats/summary', authorize(...READ_ROLES), getStats);

router.route('/')
  .get(authorize(...READ_ROLES), getFeedbacks)
  .post(authorizeOrQueue('feedbacks', 'write', ...WRITE_ROLES), createFeedbackValidators, handleValidationErrors, createFeedback);

router.route('/:id')
  .get(authorize(...READ_ROLES), getFeedback)
  .put(authorizeOrQueue('feedbacks', 'write', ...UPDATE_ROLES), updateFeedbackValidators, handleValidationErrors, updateFeedback)
  .delete(authorizeOrQueue('feedbacks', 'delete', ...WRITE_ROLES), deleteFeedback);

module.exports = router;
