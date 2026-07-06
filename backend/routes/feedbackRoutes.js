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

const router = express.Router();

// All feedback routes are protected
router.use(protect);

// Stats route must come before /:id to avoid matching "stats" as an ID
router.get('/stats/summary', getStats);

router.route('/').get(getFeedbacks).post(createFeedback);
router.route('/:id').get(getFeedback).put(updateFeedback).delete(deleteFeedback);

module.exports = router;
