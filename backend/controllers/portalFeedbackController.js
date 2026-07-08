const Feedback = require('../models/Feedback');
const Customer = require('../models/Customer');
const { calculatePriority } = require('../utils/revenueImpact');

/**
 * @route   GET /api/portal/feedbacks
 * @desc    A customer's own support tickets. `customer` is ALWAYS taken from
 *          the authenticated portal token — never from query/body — so one
 *          customer can never enumerate another's tickets (IDOR guard).
 */
const getMyFeedbacks = async (req, res, next) => {
  try {
    const feedbacks = await Feedback.find({ customer: req.customerId }).sort('-createdAt');
    res.json({ success: true, data: feedbacks });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/portal/feedbacks/:id
 */
const getMyFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    // 404 (not 403) on a foreign ticket — don't confirm the ID exists at all.
    if (!feedback || !feedback.customer.equals(req.customerId)) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
    }

    res.json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/portal/feedbacks
 * @desc    Create a new ticket. Priority/revenueImpact are auto-derived from
 *          the customer's MRR — same business logic the internal CRM uses.
 */
const createMyFeedback = async (req, res, next) => {
  try {
    const { title, description, type } = req.body;

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Müşteri kaydı bulunamadı.' });
    }

    const feedback = await Feedback.create({
      title,
      description,
      type: type || 'improvement',
      customer: customer._id,
      revenueImpact: customer.mrr,
      priority: calculatePriority(customer.mrr),
    });

    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyFeedbacks, getMyFeedback, createMyFeedback };
