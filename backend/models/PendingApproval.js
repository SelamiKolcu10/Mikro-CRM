const mongoose = require('mongoose');

/**
 * Created by authorizeOrQueue when a user acts under a granted
 * PermissionOverride rather than their native role — the write is
 * intercepted here instead of reaching the controller, and only actually
 * happens if/when a super_admin approves it (see controllers/approvalController.js).
 *
 * `baseVersion` (the target's updatedAt at request time, update/delete only)
 * guards against approving a request against data that has since moved —
 * see the 'conflict' status.
 */
const pendingApprovalSchema = new mongoose.Schema(
  {
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resource: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    baseVersion: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'conflict'],
      default: 'pending',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

pendingApprovalSchema.index({ status: 1, createdAt: -1 });
pendingApprovalSchema.index({ requestedBy: 1, createdAt: -1 });

module.exports = mongoose.model('PendingApproval', pendingApprovalSchema);
