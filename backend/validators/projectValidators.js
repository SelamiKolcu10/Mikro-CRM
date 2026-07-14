const { body, param } = require('express-validator');

// title/description gibi projede de .escape() kullanılmıyor — Markdown
// render'ı frontend'de react-markdown ile yapılır (HTML'i default render
// etmez), React zaten JSX metnini güvenle kaçırır (bkz. taskValidators.js
// aynı rasyonel).
const createProjectValidators = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Proje adı 2-100 karakter olmalıdır.'),
  body('techStack').optional().isArray().withMessage('techStack bir dizi olmalıdır.'),
  body('techStack.*').optional().isString().trim().isLength({ max: 40 }).withMessage('Geçersiz teknoloji adı.'),
  body('architectureNotes').optional({ nullable: true }).trim().isLength({ max: 20000 }).withMessage('Mimari notlar en fazla 20000 karakter olabilir.'),
  body('teamMembers').optional().isArray().withMessage('teamMembers bir dizi olmalıdır.'),
  body('teamMembers.*').optional().isMongoId().withMessage('Geçersiz kullanıcı kimliği.'),
  body('projectLead').optional({ nullable: true }).isMongoId().withMessage('Geçersiz proje lideri kimliği.'),
];

const updateProjectValidators = [
  param('id').isMongoId().withMessage('Geçersiz proje kimliği.'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Proje adı 2-100 karakter olmalıdır.'),
  body('techStack').optional().isArray().withMessage('techStack bir dizi olmalıdır.'),
  body('techStack.*').optional().isString().trim().isLength({ max: 40 }).withMessage('Geçersiz teknoloji adı.'),
  body('architectureNotes').optional({ nullable: true }).trim().isLength({ max: 20000 }).withMessage('Mimari notlar en fazla 20000 karakter olabilir.'),
  body('teamMembers').optional().isArray().withMessage('teamMembers bir dizi olmalıdır.'),
  body('teamMembers.*').optional().isMongoId().withMessage('Geçersiz kullanıcı kimliği.'),
  body('projectLead').optional({ nullable: true }).isMongoId().withMessage('Geçersiz proje lideri kimliği.'),
];

const projectIdValidators = [
  param('id').isMongoId().withMessage('Geçersiz proje kimliği.'),
];

const addProjectCommentValidators = [
  param('id').isMongoId().withMessage('Geçersiz proje kimliği.'),
  body('text').trim().isLength({ min: 1, max: 1000 }).withMessage('Yorum 1-1000 karakter olmalıdır.'),
];

module.exports = {
  createProjectValidators,
  updateProjectValidators,
  projectIdValidators,
  addProjectCommentValidators,
};
