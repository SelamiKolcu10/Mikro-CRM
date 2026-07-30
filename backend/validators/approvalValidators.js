const { body, param } = require('express-validator');

const rejectApprovalValidators = [
  body('reason').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Gerekçe 500 karakteri geçemez.'),
];


const approvalIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz onay kimliği.'),
];

module.exports = { approvalIdValidators, rejectApprovalValidators };
