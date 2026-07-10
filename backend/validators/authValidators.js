const { body } = require('express-validator');

const loginValidators = [
  body('email').trim().isEmail().withMessage('Geçerli bir e-posta girin.').normalizeEmail(),
  body('password').notEmpty().withMessage('Şifre gereklidir.'),
];

const changePasswordValidators = [
  body('currentPassword').notEmpty().withMessage('Mevcut şifre gereklidir.'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Yeni şifre en az 8 karakter olmalıdır.')
    .matches(/[a-zA-Z]/)
    .withMessage('Yeni şifre en az bir harf içermelidir.')
    .matches(/[0-9]/)
    .withMessage('Yeni şifre en az bir rakam içermelidir.'),
];

module.exports = { loginValidators, changePasswordValidators };
