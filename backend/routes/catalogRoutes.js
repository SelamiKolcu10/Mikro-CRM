const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { PERMISSIONS } = require('../config/permissions');
const {
  catalogIdValidators,
  createCatalogValidators,
  updateCatalogValidators,
} = require('../validators/catalogValidators');
const {
  getProducts,
  createProduct,
  getProduct,
  updateProduct,
  archiveProduct,
  getSalesSummary,
} = require('../controllers/catalogController');

// Ürün Kataloğu — intern BİLEREK yok (deals ile aynı çizgi, ciro verisi kapalı).
// GÖRÜNTÜLEME (accountant dahil):
router.get('/', protect, authorize(...PERMISSIONS.catalog.read), getProducts);
router.get('/sales-summary', protect, authorize(...PERMISSIONS.catalog.read), getSalesSummary);
router.get('/:id', protect, authorize(...PERMISSIONS.catalog.read), catalogIdValidators, handleValidationErrors, getProduct);

// DEĞİŞTİRME (yalnız super_admin + staff):
router.post('/', protect, authorize(...PERMISSIONS.catalog.write), createCatalogValidators, handleValidationErrors, createProduct);
router.patch('/:id', protect, authorize(...PERMISSIONS.catalog.write), updateCatalogValidators, handleValidationErrors, updateProduct);
router.delete('/:id', protect, authorize(...PERMISSIONS.catalog.write), catalogIdValidators, handleValidationErrors, archiveProduct);

module.exports = router;
