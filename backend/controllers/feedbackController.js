const Feedback = require('../models/Feedback');
const Customer = require('../models/Customer');
const { calculatePriority } = require('../utils/revenueImpact');
const auditService = require('../utils/auditService');

const FEEDBACK_WATCHED_FIELDS = ['title', 'description', 'type', 'status', 'assignedTo'];

const notFound = (message) => Object.assign(new Error(message), { statusCode: 404 });

/**
 * @route   GET /api/feedbacks
 * @desc    Get all feedbacks, sorted by revenue impact (highest first)
 */
const getFeedbacks = async (req, res, next) => {
  try {
    const {
      type,
      status,
      priority,
      customer,
      sort = '-revenueImpact',
      page = 1,
      limit = 20,
      search,
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (customer) filter.customer = customer;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [feedbacks, total] = await Promise.all([
      Feedback.find(filter)
        .populate('customer', 'name email company plan mrr')
        .populate('assignedTo', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Feedback.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: feedbacks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/feedbacks/stats/summary
 * @desc    Dashboard statistics
 */
const getStats = async (req, res, next) => {
  try {
    const [
      totalFeedbacks,
      openBugs,
      inProgressCount,
      resolvedCount,
      revenueAtRisk,
      byType,
      byPriority,
      byStatus,
      totalCustomers,
      customersByPlan,
      totalMRR,
    ] = await Promise.all([
      Feedback.countDocuments(),
      Feedback.countDocuments({ type: 'bug', status: { $in: ['open', 'in-progress'] } }),
      Feedback.countDocuments({ status: 'in-progress' }),
      Feedback.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
      Feedback.aggregate([
        { $match: { status: { $in: ['open', 'in-progress'] } } },
        { $group: { _id: null, total: { $sum: '$revenueImpact' } } },
      ]),
      Feedback.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      Feedback.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Feedback.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Customer.countDocuments(),
      Customer.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
      Customer.aggregate([
        { $group: { _id: null, total: { $sum: '$mrr' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalFeedbacks,
        openBugs,
        inProgressCount,
        resolvedCount,
        revenueAtRisk: revenueAtRisk[0]?.total || 0,
        totalCustomers,
        totalMRR: totalMRR[0]?.total || 0,
        byType: byType.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        byPriority: byPriority.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        customersByPlan: customersByPlan.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/feedbacks/:id
 * @desc    Get single feedback with customer details
 */
const getFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate('customer', 'name email company plan mrr source')
      .populate('assignedTo', 'name email');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: 'Feedback not found',
      });
    }

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// execute* — business logic only, no `req`/`res` dependency. Reused by the
// direct HTTP handlers below and by approvalController.js on approval of a
// queued request. Auditing stays out of these (needs actor context that
// differs per caller — see callers below).
// ---------------------------------------------------------------------------

async function executeCreateFeedback({ customer: customerId, title, description, type, assignedTo }) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw notFound('Customer not found');

  const feedback = await Feedback.create({
    title,
    description,
    type,
    customer: customerId,
    revenueImpact: customer.mrr,
    priority: calculatePriority(customer.mrr),
    assignedTo: assignedTo || null,
  });

  await feedback.populate('customer', 'name email company plan mrr');
  return feedback;
}

async function executeUpdateFeedback(id, payload) {
  // revenueImpact/priority are auto-calculated from customer MRR — never
  // settable directly, whether the write comes from the direct route or an
  // approved queued request.
  const { revenueImpact, priority, ...updateData } = payload;

  const before = await Feedback.findById(id);
  if (!before) throw notFound('Feedback not found');
  const beforeSnapshot = before.toObject();

  const feedback = await Feedback.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
    .populate('customer', 'name email company plan mrr')
    .populate('assignedTo', 'name email');

  return { feedback, beforeSnapshot };
}

async function executeDeleteFeedback(id) {
  const feedback = await Feedback.findByIdAndDelete(id);
  if (!feedback) throw notFound('Feedback not found');
  return feedback;
}

/**
 * @route   POST /api/feedbacks
 * @desc    Create feedback — auto-calculates revenueImpact & priority from customer's MRR
 */
const createFeedback = async (req, res, next) => {
  try {
    const feedback = await executeCreateFeedback(req.body);

    await auditService.record({
      req,
      collectionName: 'Feedback',
      documentId: feedback._id,
      action: 'create',
      after: feedback.toObject(),
    });

    res.status(201).json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/feedbacks/:id
 * @desc    Update feedback (status, assignment, etc.)
 */
const updateFeedback = async (req, res, next) => {
  try {
    const { feedback, beforeSnapshot } = await executeUpdateFeedback(req.params.id, req.body);

    await auditService.record({
      req,
      collectionName: 'Feedback',
      documentId: feedback._id,
      action: 'update',
      before: beforeSnapshot,
      after: feedback.toObject(),
      watchedFields: FEEDBACK_WATCHED_FIELDS,
    });

    res.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/feedbacks/:id
 * @desc    Delete a feedback
 */
const deleteFeedback = async (req, res, next) => {
  try {
    const feedback = await executeDeleteFeedback(req.params.id);

    await auditService.record({
      req,
      collectionName: 'Feedback',
      documentId: feedback._id,
      action: 'delete',
      before: feedback.toObject(),
    });

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFeedbacks,
  getFeedback,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getStats,
  executeCreateFeedback,
  executeUpdateFeedback,
  executeDeleteFeedback,
  FEEDBACK_WATCHED_FIELDS,
};
