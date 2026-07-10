const { body } = require('express-validator');
const { OVERRIDABLE_RESOURCES } = require('../config/permissions');

const grantOverrideValidators = [
  body('userId').isMongoId().withMessage('Geçersiz kullanıcı kimliği.'),
  body('resource').isIn(OVERRIDABLE_RESOURCES).withMessage('Geçersiz kaynak.'),
  body('action').isIn(['write', 'delete']).withMessage('Geçersiz aksiyon.'),
  body('rationale').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).escape(),
];

module.exports = { grantOverrideValidators };
