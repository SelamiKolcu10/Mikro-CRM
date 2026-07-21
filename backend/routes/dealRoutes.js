const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');
const { PERMISSIONS } = require('../config/permissions');
const {
  createDealValidators,
  dealIdValidators,
  updateDealStageValidators,
  updateDealValidators,
  addDealNoteValidators,
} = require('../validators/dealValidators');
const {
  getDeals,
  getDealEvents,
  createDeal,
  updateDealStage,
  updateDeal,
  addDealNote,
} = require('../controllers/dealController');

// Satış Pipeline — intern BİLEREK yok (deals.read = super_admin/staff/accountant,
// deals.write = super_admin/staff). deal.value hassas ciro verisi olduğundan
// leads'teki gibi redactForIntern maskeleme YOK; intern route'a hiç girmez.
// GÖRÜNTÜLEME (accountant dahil):
router.get('/', protect, authorize(...PERMISSIONS.deals.read), getDeals);
router.get('/:id/events', protect, authorize(...PERMISSIONS.deals.read), dealIdValidators, handleValidationErrors, getDealEvents);

// DEĞİŞTİRME (yalnız super_admin + staff):
router.post('/', protect, authorize(...PERMISSIONS.deals.write), createDealValidators, handleValidationErrors, createDeal);
router.patch('/:id/stage', protect, authorize(...PERMISSIONS.deals.write), updateDealStageValidators, handleValidationErrors, updateDealStage);
router.patch('/:id', protect, authorize(...PERMISSIONS.deals.write), updateDealValidators, handleValidationErrors, updateDeal);
router.post('/:id/notes', protect, authorize(...PERMISSIONS.deals.write), addDealNoteValidators, handleValidationErrors, addDealNote);

module.exports = router;
