const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const {
  createProjectValidators,
  updateProjectValidators,
  projectIdValidators,
  addProjectCommentValidators,
} = require('../validators/projectValidators');
const { PERMISSIONS } = require('../config/permissions');
const { canManageProjects, canViewProject, canEditProject } = require('../utils/projectScope');
const Project = require('../models/Project');
const {
  getProjects,
  getProjectById,
  getProjectTasks,
  getMyProjects,
  getEligibleMembers,
  getProjectComments,
  addProjectComment,
  createProject,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');

/**
 * Proje CRUD + tam liste — spec'in "API shielding" isteği: kaba rol filtresi
 * (PERMISSIONS.projects) staff'ı da içeri sokar, asıl kural burada,
 * requireProjectManager'da uygulanır (super_admin veya development lideri
 * değilse 403). Bkz. utils/projectScope.js.
 */
const requireProjectManager = (req, res, next) => {
  if (!canManageProjects(req.user)) {
    return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok.' });
  }
  next();
};

/**
 * Tek bir projenin görev akışı/yorumları — yönetici HER ZAMAN, ekip üyesi
 * SADECE KENDİ projesinde (bkz. canViewProject). requireProjectManager'dan
 * daha geniş: proje çalışanlarının o panelde tartışabilmesi için (bkz.
 * design doc'a sonradan eklenen "proje tartışması" bölümü). Proje `req.project`
 * içine konur — controller'lar tekrar sorgu atmaz.
 */
const requireProjectViewer = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proje bulunamadı.' });
    }
    if (!canViewProject(req.user, project)) {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok.' });
    }
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Proje düzenleme (PATCH) — global yönetici HER ZAMAN, ya da BU projenin
 * atanmış lideri (bkz. canEditProject). Oluşturma/silme/tam liste bunun
 * dışında, hâlâ requireProjectManager'da (global, projeye özel değil).
 */
const requireProjectEditor = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Proje bulunamadı.' });
    }
    if (!canEditProject(req.user, project)) {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok.' });
    }
    next();
  } catch (error) {
    next(error);
  }
};

router.use(protect, authorize(...PERMISSIONS.projects.read));

// Sırayla önemli: /mine ve /eligible-members, /:id param route'undan ÖNCE
// tanımlanmalı, yoksa Express onları :id olarak eşleştirir.
router.get('/mine', getMyProjects);
router.get('/eligible-members', requireProjectManager, getEligibleMembers);
router.get('/', requireProjectManager, getProjects);
router.get('/:id', projectIdValidators, handleValidationErrors, requireProjectManager, getProjectById);
router.get('/:id/tasks', projectIdValidators, handleValidationErrors, requireProjectViewer, getProjectTasks);
router.get('/:id/comments', projectIdValidators, handleValidationErrors, requireProjectViewer, getProjectComments);
router.post('/:id/comments', addProjectCommentValidators, handleValidationErrors, requireProjectViewer, addProjectComment);
router.post('/', requireProjectManager, createProjectValidators, handleValidationErrors, createProject);
router.patch('/:id', updateProjectValidators, handleValidationErrors, requireProjectEditor, updateProject);
router.delete('/:id', requireProjectManager, projectIdValidators, handleValidationErrors, deleteProject);

module.exports = router;
