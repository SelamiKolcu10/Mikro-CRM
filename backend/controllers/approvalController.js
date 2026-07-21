const PendingApproval = require('../models/PendingApproval');
const User = require('../models/User');
const auditService = require('../utils/auditService');
const { RESOURCE_MODEL } = require('../middleware/authorizeOrQueue');
const {
  executeCreateCustomer,
  executeUpdateCustomer,
  executeDeleteCustomer,
  CUSTOMER_WATCHED_FIELDS,
} = require('./customerController');
const {
  executeCreateFeedback,
  executeUpdateFeedback,
  executeDeleteFeedback,
  FEEDBACK_WATCHED_FIELDS,
} = require('./feedbackController');

/**
 * One entry per (resource, action) this queue supports — each wraps the
 * shared execute* function (see the respective controller) with the audit
 * call for that resource. This is the ONLY place PendingApproval touches
 * business logic, and it does so by calling the same functions the direct
 * HTTP routes call — no duplicated logic, no drift between the two paths.
 */
const DISPATCH = {
  customers: {
    create: async (payload, auditReq) => {
      const customer = await executeCreateCustomer(payload);
      await auditService.record({ req: auditReq, collectionName: 'Customer', documentId: customer._id, action: 'create', after: customer.toObject() });
      return customer;
    },
    update: async (payload, auditReq, targetId) => {
      const { customer, beforeSnapshot } = await executeUpdateCustomer(targetId, payload, auditReq.user);
      await auditService.record({ req: auditReq, collectionName: 'Customer', documentId: customer._id, action: 'update', before: beforeSnapshot, after: customer.toObject(), watchedFields: CUSTOMER_WATCHED_FIELDS });
      return customer;
    },
    delete: async (payload, auditReq, targetId) => {
      const customer = await executeDeleteCustomer(targetId);
      await auditService.record({ req: auditReq, collectionName: 'Customer', documentId: customer._id, action: 'delete', before: customer.toObject() });
      return customer;
    },
  },
  feedbacks: {
    create: async (payload, auditReq) => {
      const feedback = await executeCreateFeedback(payload);
      await auditService.record({ req: auditReq, collectionName: 'Feedback', documentId: feedback._id, action: 'create', after: feedback.toObject() });
      return feedback;
    },
    update: async (payload, auditReq, targetId) => {
      const { feedback, beforeSnapshot } = await executeUpdateFeedback(targetId, payload);
      await auditService.record({ req: auditReq, collectionName: 'Feedback', documentId: feedback._id, action: 'update', before: beforeSnapshot, after: feedback.toObject(), watchedFields: FEEDBACK_WATCHED_FIELDS });
      return feedback;
    },
    delete: async (payload, auditReq, targetId) => {
      const feedback = await executeDeleteFeedback(targetId);
      await auditService.record({ req: auditReq, collectionName: 'Feedback', documentId: feedback._id, action: 'delete', before: feedback.toObject() });
      return feedback;
    },
  },
};

async function markReviewed(pending, status, reviewerId, note) {
  pending.status = status;
  pending.reviewedBy = reviewerId;
  pending.reviewedAt = new Date();
  if (note) pending.rejectionReason = note;
  await pending.save();
  return pending;
}

/**
 * @route   GET /api/approvals
 * @desc    Super Admin review queue — all requests, optionally filtered.
 */
const getApprovals = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const approvals = await PendingApproval.find(filter)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email')
      .sort('-createdAt');

    res.json({ success: true, data: approvals });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/approvals/mine
 * @desc    A requester's own queued actions, any status — powers the
 *          "Awaiting Admin Approval" badges on their own list views.
 */
const getMyApprovals = async (req, res, next) => {
  try {
    const filter = { requestedBy: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const approvals = await PendingApproval.find(filter).sort('-createdAt');
    res.json({ success: true, data: approvals });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/approvals/:id/approve
 * @desc    Re-checks the target hasn't moved since the request was queued
 *          (baseVersion), then dispatches through the same execute*
 *          function the direct route would have called. Any staleness or
 *          dispatch-time failure marks the request 'conflict' instead of
 *          crashing or silently clobbering newer data.
 */
const approveRequest = async (req, res, next) => {
  try {
    const pending = await PendingApproval.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
    }
    if (pending.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Bu talep zaten sonuçlandırılmış.' });
    }

    // Staleness check — only applies to update/delete (create has no target).
    if (pending.targetId) {
      const Model = RESOURCE_MODEL[pending.resource];
      const current = Model ? await Model.findById(pending.targetId).select('updatedAt') : null;

      if (!current) {
        await markReviewed(pending, 'conflict', req.user._id, 'Kayıt onay beklerken silinmiş.');
        return res.json({ success: true, data: pending });
      }
      if (pending.baseVersion && current.updatedAt.getTime() !== new Date(pending.baseVersion).getTime()) {
        await markReviewed(pending, 'conflict', req.user._id, 'Kayıt onay beklerken başka bir işlemle değiştirilmiş.');
        return res.json({ success: true, data: pending });
      }
    }

    const requester = await User.findById(pending.requestedBy);
    // Actor for the audit trail is the original requester (their intent
    // caused the change), using the approver's live request for IP/UA — the
    // approval workflow's own reviewedBy/reviewedAt is the record of who
    // signed off on it.
    const auditReq = { user: requester, ip: req.ip, headers: req.headers };

    const resourceDispatch = DISPATCH[pending.resource];
    const handler = resourceDispatch && resourceDispatch[pending.action];
    if (!handler) {
      return res.status(400).json({ success: false, error: `Desteklenmeyen kaynak/aksiyon: ${pending.resource}/${pending.action}` });
    }

    try {
      await handler(pending.payload, auditReq, pending.targetId, pending.requestedBy);
    } catch (dispatchError) {
      await markReviewed(pending, 'conflict', req.user._id, dispatchError.message || 'İşlem uygulanamadı.');
      return res.json({ success: true, data: pending });
    }

    await markReviewed(pending, 'approved', req.user._id);
    res.json({ success: true, data: pending });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/approvals/:id/reject
 */
const rejectRequest = async (req, res, next) => {
  try {
    const pending = await PendingApproval.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
    }
    if (pending.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Bu talep zaten sonuçlandırılmış.' });
    }

    await markReviewed(pending, 'rejected', req.user._id, req.body.reason || null);
    res.json({ success: true, data: pending });
  } catch (error) {
    next(error);
  }
};

module.exports = { getApprovals, getMyApprovals, approveRequest, rejectRequest };
