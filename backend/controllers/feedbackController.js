const Feedback = require('../models/Feedback');
const Customer = require('../models/Customer');
const { calculatePriority } = require('../utils/revenueImpact');

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
      sort = '-revenueImpact',
      page = 1,
      limit = 20,
      search,
    } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
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

/**
 * @route   POST /api/feedbacks
 * @desc    Create feedback — auto-calculates revenueImpact & priority from customer's MRR
 */
const createFeedback = async (req, res, next) => {
  try {
    const { customer: customerId, title, description, type } = req.body;

    // Fetch customer to get MRR for automatic priority calculation
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    const feedback = await Feedback.create({
      title,
      description,
      type,
      customer: customerId,
      revenueImpact: customer.mrr,
      priority: calculatePriority(customer.mrr),
      assignedTo: req.body.assignedTo || null,
    });

    // Populate customer info before returning
    await feedback.populate('customer', 'name email company plan mrr');

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
    // Don't allow direct modification of revenueImpact or priority
    // (these are auto-calculated from customer MRR)
    const { revenueImpact, priority, ...updateData } = req.body;

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('customer', 'name email company plan mrr')
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

/**
 * @route   DELETE /api/feedbacks/:id
 * @desc    Delete a feedback
 */
const deleteFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: 'Feedback not found',
      });
    }

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
};
