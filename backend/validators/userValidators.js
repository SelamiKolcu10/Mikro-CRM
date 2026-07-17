const { body } = require('express-validator');
const { ALL_ROLES, ROLES, DEPARTMENTS } = require('../config/permissions');

// createUser deliberately excludes super_admin — mirrors the same guard
// already enforced in userController.createUser (defense in depth).
const CREATABLE_ROLES = ALL_ROLES.filter((r) => r !== ROLES.SUPER_ADMIN);

const createUserValidators = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('İsim 2-50 karakter olmalıdır.')
    .escape(),
  body('email').trim().isEmail().withMessage('Geçerli bir e-posta girin.').normalizeEmail(),
  body('role').isIn(CREATABLE_ROLES).withMessage('Geçersiz rol.'),
];

const updateUserRoleValidators = [
  body('role').isIn(ALL_ROLES).withMessage('Geçersiz rol.'),
];

// approveUser accepts an OPTIONAL role (admin may finalize/change it at
// approval time) — unlike updateUserRoleValidators, absence is fine.
const approveUserValidators = [
  body('role').optional().isIn(ALL_ROLES).withMessage('Geçersiz rol.'),
];

const rejectUserValidators = [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Sebep en fazla 500 karakter olabilir.').escape(),
];

const updateUserDepartmentValidators = [
  body('department').optional({ nullable: true }).isIn(DEPARTMENTS).withMessage('Geçersiz departman.'),
  body('isDepartmentLead').optional().isBoolean().withMessage('isDepartmentLead boolean olmalıdır.'),
];

// Profilim — telefon serbest metin (uluslararası formatlar için sıkı bir
// regex zorlamıyoruz), LinkedIn/GitHub domain'e kilitli (bkz. User modelindeki
// aynı match kuralı — burada da tekrarlanır ki hatalı istek save() beklemeden
// 400 dönsün).
const updateContactInfoValidators = [
  body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }).withMessage('Telefon en fazla 30 karakter olabilir.').escape(),
  body('linkedin')
    .optional({ nullable: true })
    .trim()
    .matches(/^$|^https?:\/\/(www\.)?linkedin\.com\/.*$/)
    .withMessage('Geçerli bir LinkedIn adresi giriniz.'),
  body('github')
    .optional({ nullable: true })
    .trim()
    .matches(/^$|^https?:\/\/(www\.)?github\.com\/.*$/)
    .withMessage('Geçerli bir GitHub adresi giriniz.'),
];

module.exports = {
  createUserValidators,
  approveUserValidators,
  updateUserRoleValidators,
  rejectUserValidators,
  updateUserDepartmentValidators,
  updateContactInfoValidators,
};
