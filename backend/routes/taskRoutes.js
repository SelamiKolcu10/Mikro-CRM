const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { redactForIntern } = require('../middleware/redactForIntern');
const { handleValidationErrors } = require('../middleware/validate');
const {
  createTaskValidators,
  taskIdValidators,
  updateTaskStatusValidators,
  updateTaskDeadlineValidators,
  assignableUsersValidators,
  workloadStatusValidators,
  activityHeatmapValidators,
  addCommentValidators,
} = require('../validators/taskValidators');
const { PERMISSIONS } = require('../config/permissions');
const {
  getTasks,
  getAssignableUsers,
  getWorkloadStatus,
  createTask,
  updateTaskStatus,
  updateTaskDeadline,
  getActivityHeatmap,
  getTaskComments,
  addTaskComment,
} = require('../controllers/taskController');

// Görev modülü — super_admin, staff (bkz. config/permissions.js — asıl
// departman/lider kontrolü taskController + taskScope içinde yapılır)
router.use(protect, authorize(...PERMISSIONS.tasks.read));

router.get('/', redactForIntern, getTasks);
router.get('/assignable-users', assignableUsersValidators, handleValidationErrors, getAssignableUsers);
router.get('/workload-status', workloadStatusValidators, handleValidationErrors, getWorkloadStatus);
router.get('/activity-heatmap', activityHeatmapValidators, handleValidationErrors, getActivityHeatmap);
router.post('/', authorize(...PERMISSIONS.tasks.write), createTaskValidators, handleValidationErrors, createTask);
router.patch(
  '/:id/status',
  taskIdValidators,
  updateTaskStatusValidators,
  handleValidationErrors,
  updateTaskStatus
);
router.patch(
  '/:id/deadline',
  taskIdValidators,
  updateTaskDeadlineValidators,
  handleValidationErrors,
  updateTaskDeadline
);
router.get('/:id/comments', redactForIntern, taskIdValidators, handleValidationErrors, getTaskComments);
router.post('/:id/comments', addCommentValidators, handleValidationErrors, addTaskComment);

module.exports = router;
