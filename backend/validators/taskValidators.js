const { body, param, query } = require('express-validator');
const { DEPARTMENTS, TASK_PRIORITIES, TASK_STATUSES } = require('../config/permissions');

// Deliberately NOT using express-validator's .escape() here (see the same
// rationale in validators/chatValidators.js) — task title/description are
// rendered as plain JSX text, which React already escapes safely against
// XSS. Running .escape() first would HTML-entity-encode punctuation (e.g.
// "<Header> & footer" -> "&lt;Header&gt; &amp; footer") and React would
// display those literal entity characters instead of decoding them.
const createTaskValidators = [
  body('title').trim().isLength({ min: 2, max: 150 }).withMessage('Başlık 2-150 karakter olmalıdır.'),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }).withMessage('Açıklama en fazla 2000 karakter olabilir.'),
  body('department').isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
  body('priority').optional().isIn(TASK_PRIORITIES).withMessage('Geçersiz öncelik.'),
  body('deadline').optional({ nullable: true }).isISO8601().withMessage('Geçersiz tarih.'),
  body('assignedTo').isMongoId().withMessage('Geçersiz kullanıcı kimliği.'),
  body('projectId').optional({ nullable: true }).isMongoId().withMessage('Geçersiz proje kimliği.'),
];

const taskIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz görev kimliği.'),
];

const addCommentValidators = [
  param('id').isMongoId().withMessage('Geçersiz görev kimliği.'),
  body('text').trim().isLength({ min: 1, max: 1000 }).withMessage('Yorum 1-1000 karakter olmalıdır.'),
];

const updateTaskStatusValidators = [
  param('id').isMongoId().withMessage('Geçersiz görev kimliği.'),
  body('status').isIn(TASK_STATUSES).withMessage('Geçersiz durum.'),
];

const updateTaskDeadlineValidators = [
  param('id').isMongoId().withMessage('Geçersiz görev kimliği.'),
  body('deadline').optional({ nullable: true }).isISO8601().withMessage('Geçersiz tarih.'),
  body('expectedVersion').optional().isInt({ min: 0 }).withMessage('Geçersiz sürüm.'),
];

const assignableUsersValidators = [
  query('department').optional().isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
];

const workloadStatusValidators = [
  query('department').optional().isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
];

const activityHeatmapValidators = [
  query('department').optional().isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
  query('userId').optional().isMongoId().withMessage('Geçersiz kullanıcı kimliği.'),
];

module.exports = {
  createTaskValidators,
  taskIdValidators,
  updateTaskStatusValidators,
  updateTaskDeadlineValidators,
  assignableUsersValidators,
  workloadStatusValidators,
  activityHeatmapValidators,
  addCommentValidators,
};
