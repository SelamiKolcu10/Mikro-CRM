const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authorize');
const { redactForIntern } = require('../middleware/redactForIntern');
const { leadRateLimiter } = require('../middleware/security');
const { handleValidationErrors } = require('../middleware/validate');
const { PERMISSIONS } = require('../config/permissions');
const {
  createLeadValidators,
  leadIdValidators,
  updateLeadStatusValidators,
  addLeadNoteValidators,
} = require('../validators/leadValidators');
const {
  checkHoneypot,
  createLead,
  getLeads,
  getLeadEvents,
  updateLeadStatus,
  addLeadNote,
  assignLeadToMe,
} = require('../controllers/leadController');

// Bilerek router genelinde `protect` YOK — bu router'ın POST / route'u
// uygulamadaki ilk auth'suz yazma yüzeyi (bkz. spec §3). Aşağıdaki panel
// route'larının HER BİRİ kendi satırında protect+authorize taşır ki bu
// public route yanlışlıkla korumaya girmesin.
router.post(
  '/',
  leadRateLimiter,
  checkHoneypot,
  createLeadValidators,
  handleValidationErrors,
  createLead
);

// ---- Panel (Formlar) ----
// GÖRÜNTÜLEME: super_admin, staff + accountant/support/intern salt-okunur
// (leads.read). intern GET'lerinde redactForIntern → email/telefon maskeli.
// DEĞİŞTİRME: yalnız super_admin+staff (leads.write) — accountant/support/
// intern bu route'lardan 403 alır (frontend'de de butonlar gizli).
router.get('/', protect, authorize(...PERMISSIONS.leads.read), redactForIntern, getLeads);
router.get('/:id/events', protect, authorize(...PERMISSIONS.leads.read), redactForIntern, leadIdValidators, handleValidationErrors, getLeadEvents);
router.patch('/:id/status', protect, authorize(...PERMISSIONS.leads.write), updateLeadStatusValidators, handleValidationErrors, updateLeadStatus);
router.post('/:id/notes', protect, authorize(...PERMISSIONS.leads.write), addLeadNoteValidators, handleValidationErrors, addLeadNote);
router.patch('/:id/assign-to-me', protect, authorize(...PERMISSIONS.leads.write), leadIdValidators, handleValidationErrors, assignLeadToMe);

module.exports = router;
