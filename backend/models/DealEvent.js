const mongoose = require('mongoose');
const { DEAL_STAGES } = require('../config/deals');

const ACTIONS = ['created', 'stage_changed', 'value_changed', 'note_added', 'won', 'lost', 'assigned'];

/**
 * Deal'in operasyonel zaman çizelgesi — LeadEvent/TaskActivity ile birebir aynı
 * desen: denormalize snapshot'lar (actorName) sayesinde timeline User'a join
 * yapmadan render edilir. P2 (birleşik müşteri timeline'ı) bu koleksiyonu
 * doğrudan besleyecek. Bilerek AuditLog'un (hash-zincirli) DIŞINDA — operasyonel
 * iz, güvenlik-kritik değil. Tasarım: spec §1.3.
 */
const dealEventSchema = new mongoose.Schema(
  {
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true },
    // 'created' olayı dönüşümde sistem tarafından da yazılabilir; ama pratikte
    // her deal aksiyonu authed bir personelden gelir (public yazma yok, Lead'in
    // aksine). actor dolu olma kuralı controller'da uygulanır.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true },
    action: { type: String, enum: ACTIONS, default: 'stage_changed' },
    fromStage: { type: String, enum: DEAL_STAGES, default: null },
    toStage: { type: String, enum: DEAL_STAGES, default: null },
    // Yalnız action:'value_changed'.
    fromValue: { type: Number, default: null },
    toValue: { type: Number, default: null },
    // Yalnız action:'note_added'.
    note: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

dealEventSchema.index({ deal: 1, createdAt: -1 });

module.exports = mongoose.model('DealEvent', dealEventSchema);
