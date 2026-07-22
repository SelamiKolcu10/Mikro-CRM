const mongoose = require('mongoose');

/**
 * Teklif Olay Geçmişi (Audit Trail / Activity Log).
 * DealEvent ve LeadEvent desenlerine birebir uyar.
 * Public olaylarda (viewed/accepted/rejected) actor=null ve actorName müşteri/sistem adıdır.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-approval-invoice-p3b-design.md §1.2
 */
const quoteEventSchema = new mongoose.Schema(
  {
    quote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quote',
      required: [true, 'Teklif zorunludur.'],
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Müşteri tarafından yapılan public eylemlerde null
    },
    actorName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['created', 'sent', 'viewed', 'accepted', 'rejected', 'revised', 'invoiced'],
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

quoteEventSchema.index({ quote: 1, createdAt: -1 });

module.exports = mongoose.model('QuoteEvent', quoteEventSchema);
