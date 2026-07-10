const { body } = require('express-validator');

const rejectApprovalValidators = [
  body('reason').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Gerekçe 500 karakteri geçemez.'),
];

module.exports = { rejectApprovalValidators };
