const express = require('express');
const {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
} = require('../controllers/knowledgeBaseController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { ALL_ROLES, ROLES } = require('../config/permissions');

const router = express.Router();

router.use(protect);

// Everyone (including intern) can read — support + super_admin can write.
const WRITE_ROLES = [ROLES.SUPER_ADMIN, ROLES.SUPPORT];

router.route('/')
  .get(authorize(...ALL_ROLES), getArticles)
  .post(authorize(...WRITE_ROLES), createArticle);

router.route('/:id')
  .get(authorize(...ALL_ROLES), getArticle)
  .put(authorize(...WRITE_ROLES), updateArticle)
  .delete(authorize(...WRITE_ROLES), deleteArticle);

module.exports = router;
