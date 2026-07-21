const mongoose = require('mongoose');
const { CUSTOMER_EVENT_ACTIONS } = require('../config/customerEvents');

/**
 * Müşteri kartındaki birleşik timeline'ın kendi katmanı — LeadEvent/DealEvent
 * ile birebir aynı desen (denormalize actorName, join'siz render). Deal/Lead/
 * Feedback KENDİ event geçmişini burada tutmaz; bu koleksiyon yalnız (1) temsilci
 * tarafından ELLE eklenen etkileşimleri (not/arama/toplantı/e-posta) ve (2) birkaç
 * müşteri yaşam döngüsü olayını (created/plan_changed) tutar. Birleştirme
 * okuma-anında yapılır (bkz. utils/customerTimeline.js) — bkz. tasarım spec'i
 * docs/superpowers/specs/2026-07-22-customer-timeline-design.md §1.2.
 */
const customerEventSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    // Sistem olaylarında (created/plan_changed) null; manuel türlerde
    // (note/call/meeting/email) doluluk kuralı şemada değil controller'da
    // uygulanır (LeadEvent deseni — bkz. customerController.logCustomerActivity).
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true },
    action: { type: String, enum: CUSTOMER_EVENT_ACTIONS, default: 'note' },
    // Manuel türlerin gövdesi (call/meeting'de opsiyonel özet, note/email'de
    // asıl içerik). Sistem olaylarında null.
    note: { type: String, trim: true, maxlength: [2000, 'Not en fazla 2000 karakter olabilir.'], default: null },
    // Yalnız action:'plan_changed'.
    fromPlan: { type: String, default: null },
    toPlan: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

customerEventSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('CustomerEvent', customerEventSchema);
