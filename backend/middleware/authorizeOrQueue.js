const PermissionOverride = require('../models/PermissionOverride');
const PendingApproval = require('../models/PendingApproval');
const Customer = require('../models/Customer');
const Feedback = require('../models/Feedback');

// Only used here to read `updatedAt` for the staleness check below — never
// to write. Keep in sync with the resources wired to authorizeOrQueue in
// the route files.
const RESOURCE_MODEL = {
  customers: Customer,
  feedbacks: Feedback,
};

/**
 * Drop-in replacement for `authorize(...roles)` on write routes only.
 *
 * - If the caller's static role is in `staticRoles`, behaves exactly like
 *   `authorize` — proceeds to the controller immediately, no queueing.
 * - Otherwise, checks for an active PermissionOverride granting this exact
 *   (user, resource, action). None → 403, same as `authorize` would give.
 * - An active override does NOT let the request through — the whole point
 *   of an override (per spec) is that actions taken under it always require
 *   Super Admin approval. The request is captured into PendingApproval and
 *   the controller never runs; the client gets 202 + `pending:true`.
 *
 * `baseVersion` (the target's current `updatedAt`, for :id routes) is
 * captured now so approvalController can detect if the record changed
 * between the request and the eventual approval (see 'conflict' status).
 */
const authorizeOrQueue = (resource, action, ...staticRoles) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authorized' });
  }

  if (staticRoles.includes(req.user.role)) {
    return next();
  }

  try {
    const override = await PermissionOverride.findOne({
      user: req.user._id,
      resource,
      action,
      active: true,
    });

    if (!override) {
      return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok.' });
    }

    let baseVersion = null;
    if (req.params.id) {
      const Model = RESOURCE_MODEL[resource];
      const current = Model ? await Model.findById(req.params.id).select('updatedAt') : null;
      if (!current) {
        return res.status(404).json({ success: false, error: 'Kayıt bulunamadı.' });
      }
      baseVersion = current.updatedAt;
    }

    // `action` here is the PermissionOverride/permissions-matrix vocabulary
    // ('write' covers both create and update, 'delete' separately) — but
    // PendingApproval needs the actual CRUD verb so approvalController knows
    // which execute* function to dispatch to. Derived the same way the
    // routes themselves are structured: POST (no :id) = create, PUT (:id) =
    // update, the 'delete' action always maps straight across.
    const crudAction = action === 'delete' ? 'delete' : req.params.id ? 'update' : 'create';

    const pending = await PendingApproval.create({
      requestedBy: req.user._id,
      resource,
      action: crudAction,
      targetId: req.params.id || null,
      payload: req.body,
      baseVersion,
    });

    return res.status(202).json({
      success: true,
      pending: true,
      data: pending,
      message: 'İşleminiz admin onayına gönderildi.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { authorizeOrQueue, RESOURCE_MODEL };
