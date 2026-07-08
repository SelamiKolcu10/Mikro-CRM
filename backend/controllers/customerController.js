const crypto = require('crypto');
const Customer = require('../models/Customer');
const Feedback = require('../models/Feedback');
const CustomerUser = require('../models/CustomerUser');

/**
 * @route   GET /api/customers
 * @desc    Get all customers (with pagination, filtering, sorting)
 */
const getCustomers = async (req, res, next) => {
  try {
    const { plan, search, sort = '-mrr', page = 1, limit = 20 } = req.query;

    const filter = {};
    if (plan) filter.plan = plan;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Customer.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: customers,
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
 * @route   GET /api/customers/:id
 * @desc    Get single customer by ID
 */
const getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Also fetch their feedbacks
    const feedbacks = await Feedback.find({ customer: customer._id }).sort('-createdAt');

    res.json({
      success: true,
      data: { ...customer.toJSON(), feedbacks },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/customers
 * @desc    Create a new customer
 */
const createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);

    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/customers/:id
 * @desc    Update a customer
 */
const updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // If MRR changed, update all related feedbacks' revenueImpact & priority
    if (req.body.mrr !== undefined || req.body.plan !== undefined) {
      const { calculatePriority } = require('../utils/revenueImpact');
      await Feedback.updateMany(
        { customer: customer._id },
        {
          revenueImpact: customer.mrr,
          priority: calculatePriority(customer.mrr),
        }
      );
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete a customer and their feedbacks
 */
const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Delete all feedbacks belonging to this customer
    await Feedback.deleteMany({ customer: customer._id });
    await Customer.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/customers/:id/portal-access
 * @desc    Grant (or reset) this customer's portal login. There is no email
 *          infrastructure yet, so the generated password is returned once in
 *          the response — staff relays it to the customer out-of-band.
 */
const grantPortalAccess = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const tempPassword = crypto.randomBytes(9).toString('base64url'); // 12-char, URL-safe

    let customerUser = await CustomerUser.findOne({ customer: customer._id });
    if (customerUser) {
      customerUser.password = tempPassword;
      customerUser.status = 'active';
      await customerUser.save();
    } else {
      customerUser = await CustomerUser.create({
        email: customer.email,
        password: tempPassword,
        customer: customer._id,
      });
    }

    res.json({
      success: true,
      data: {
        email: customerUser.email,
        temporaryPassword: tempPassword,
        status: customerUser.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/customers/:id/portal-access/disable
 */
const disablePortalAccess = async (req, res, next) => {
  try {
    const customerUser = await CustomerUser.findOneAndUpdate(
      { customer: req.params.id },
      { status: 'disabled' },
      { new: true }
    );
    if (!customerUser) {
      return res.status(404).json({ success: false, error: 'Bu müşterinin portal erişimi yok.' });
    }
    res.json({ success: true, data: customerUser });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  grantPortalAccess,
  disablePortalAccess,
};
