const { param } = require('express-validator');

// Denetim kaydı okuma uçları yalnız kimlikle çalışır; biçimi kapıda kesmek
// ham bir değerin Mongoose'a gidip CastError'a düşmesini önler.
const auditIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz denetim kaydı kimliği.'),
];

module.exports = { auditIdValidators };
