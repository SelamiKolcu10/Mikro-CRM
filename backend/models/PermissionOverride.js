const mongoose = require('mongoose');

/**
 * Additive on top of the static role matrix (config/permissions.js) — never
 * replaces it. authorizeOrQueue only consults this when the requester's
 * static role doesn't already grant the action. Revoke sets active:false
 * rather than deleting, so the grant/revoke history survives (visible via
 * AuditLog too).
 */
const permissionOverrideSchema = new mongoose.Schema(
  {
    user: {
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
      enum: ['write', 'delete'],
      required: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Why this was granted — shown in the Access Control Matrix and in the
    // audit trail, not enforced/required (a super_admin may skip it).
    rationale: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

permissionOverrideSchema.index({ user: 1, resource: 1, action: 1 }, { unique: true });

module.exports = mongoose.model('PermissionOverride', permissionOverrideSchema);
