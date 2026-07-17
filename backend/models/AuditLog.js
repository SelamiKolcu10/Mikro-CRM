const mongoose = require('mongoose');

/**
 * Records who changed what, when, on the collections a super_admin needs to
 * be able to verify (did a customer's self-edit actually persist? did an
 * admin's user-management action really happen?). Written from the
 * controller layer (see utils/auditService.js) rather than a Mongoose hook —
 * hooks don't have access to the request's actor/IP or a clean before/after
 * diff for `findByIdAndUpdate`-style calls.
 */
const changeSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    collectionName: {
      type: String,
      // 'System' is reserved for synthetic entries the app writes about
      // itself (e.g. the hash-chain migration genesis marker), not a real
      // audited collection.
      enum: ['User', 'Customer', 'CustomerUser', 'Feedback', 'PermissionOverride', 'System'],
      required: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actorType: {
      type: String,
      enum: ['internal', 'customer', 'system'],
      required: true,
    },
    // Denormalized so the trail survives the actor account being deleted.
    actorEmail: {
      type: String,
      default: null,
    },
    changes: {
      type: [changeSchema],
      default: [],
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    // Hash-chain fields (SOC2/ISO27001-style tamper evidence). Written
    // exclusively by utils/auditChain.js:writeChainedLog — never set these
    // directly, the chain integrity depends on prevHash/hash always being
    // computed together from the previous record. See utils/auditChain.js
    // for the verification algorithm.
    sequence: {
      type: Number,
      required: true,
      unique: true,
    },
    prevHash: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['info', 'sensitive', 'critical'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ collectionName: 1, documentId: 1 });
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ severity: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
