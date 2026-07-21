const mongoose = require('mongoose');
const { LEAD_STATUSES } = require('../config/leads');

const ACTIONS = ['created', 'status_changed', 'assigned', 'note_added'];

/**
 * Lead'in operasyonel zaman çizelgesi — TaskActivity ile birebir aynı desen
 * (bkz. models/TaskActivity.js): denormalize snapshot'lar sayesinde
 * liste/timeline Lead'e/User'a join yapmadan render edilir. Bilerek
 * AuditLog'un (hash-zincirli, güvenlik-kritik) DIŞINDA tutuldu — bkz. spec
 * §1 "Jenerik spec'ten sapmalar" maddesi 1.
 */
const leadEventSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    // TaskActivity'nin aksine actor NULLABLE: 'created' olayı anonim public
    // formdan gelir, arkasında hiçbir User yok. Diğer tüm action'lar
    // (status_changed/assigned/note_added) her zaman authed bir personelden
    // gelir, onlarda actor dolu olmak zorunda — bu kural şemada değil,
    // controller'da uygulanır (bkz. leadController.js).
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true },
    action: { type: String, enum: ACTIONS, default: 'status_changed' },
    fromStatus: { type: String, enum: LEAD_STATUSES, default: null },
    toStatus: { type: String, enum: LEAD_STATUSES, default: null },
    // Yalnızca action:'note_added' — ekip içi yorum akışı ayrı bir koleksiyona
    // çıkarılmadı, zaten kronolojik timeline'ın parçası (bkz. spec §1 not).
    note: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

leadEventSchema.index({ lead: 1, createdAt: -1 });

module.exports = mongoose.model('LeadEvent', leadEventSchema);
