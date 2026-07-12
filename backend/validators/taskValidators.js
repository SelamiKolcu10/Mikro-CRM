const { body, param, query } = require('express-validator');
const { DEPARTMENTS, TASK_PRIORITIES, TASK_STATUSES } = require('../config/permissions');

const createTaskValidators = [
  body('title').trim().isLength({ min: 2, max: 150 }).withMessage('Başlık 2-150 karakter olmalıdır.').escape(),
  body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }).withMessage('Açıklama en fazla 2000 karakter olabilir.').escape(),
  body('department').isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
  body('priority').optional().isIn(TASK_PRIORITIES).withMessage('Geçersiz öncelik.'),
  body('deadline').optional({ nullable: true }).isISO8601().withMessage('Geçersiz tarih.'),
  body('assignedTo').isMongoId().withMessage('Geçersiz kullanıcı kimliği.'),
];

const taskIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz görev kimliği.'),
];

const updateTaskStatusValidators = [
  param('id').isMongoId().withMessage('Geçersiz görev kimliği.'),
  body('status').isIn(TASK_STATUSES).withMessage('Geçersiz durum.'),
];

const assignableUsersValidators = [
  query('department').optional().isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
];

module.exports = { createTaskValidators, taskIdValidators, updateTaskStatusValidators, assignableUsersValidators };
