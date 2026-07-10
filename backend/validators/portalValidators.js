const { body } = require('express-validator');

const updateProfileValidators = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('İsim 2-100 karakter olmalıdır.').escape(),
  body('email').optional().trim().isEmail().withMessage('Geçerli bir e-posta girin.').normalizeEmail(),
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

const createTicketValidators = [
  body('title').trim().isLength({ min: 3, max: 150 }).withMessage('Başlık 3-150 karakter olmalıdır.').escape(),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }).escape(),
  body('type').optional().isIn(['bug', 'feature', 'improvement']).withMessage('Geçersiz tür.'),
];

module.exports = { updateProfileValidators, changePasswordValidators, createTicketValidators };
