const crypto = require('crypto');
const Customer = require('../models/Customer');
const Feedback = require('../models/Feedback');
const CustomerUser = require('../models/CustomerUser');
const auditService = require('../utils/auditService');
const { calculatePriority } = require('../utils/revenueImpact');
const escapeRegex = require('../utils/escapeRegex');

const CUSTOMER_WATCHED_FIELDS = ['name', 'email', 'company', 'plan', 'mrr', 'source', 'notes'];

const notFound = (message) => Object.assign(new Error(message), { statusCode: 404 });

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
      // Escaped → matched as a literal substring, never as an attacker regex
      // (ReDoS guard). mongo-sanitize only strips operator KEYS, not string
      // values, so this escaping is the actual defense here.
      const safe = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
        { company: { $regex: safe, $options: 'i' } },
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

// ---------------------------------------------------------------------------
// execute* — the actual business logic (DB write + any cascading effects),
// with no dependency on `req`/`res`. Reused by both the direct HTTP handlers
// below AND approvalController.js when a queued request gets approved, so
// there is exactly one place MRR-cascade/etc. logic lives. Auditing is
// deliberately NOT done in here — it needs actor/IP context that differs
// between "a user did this directly" and "an admin approved someone else's
// queued request" — see the callers.
// ---------------------------------------------------------------------------

async function executeCreateCustomer(payload) {
  return Customer.create(payload);
}

async function executeUpdateCustomer(id, payload) {
  const before = await Customer.findById(id);
  if (!before) throw notFound('Customer not found');
  const beforeSnapshot = before.toObject();

  const customer = await Customer.findByIdAndUpdate(id, payload, { new: true, runValidators: true });

  // If MRR changed, update all related feedbacks' revenueImpact & priority
  if (payload.mrr !== undefined || payload.plan !== undefined) {
    await Feedback.updateMany(
      { customer: customer._id },
      { revenueImpact: customer.mrr, priority: calculatePriority(customer.mrr) }
    );
  }

  return { customer, beforeSnapshot };
}

async function executeDeleteCustomer(id) {
  const customer = await Customer.findById(id);
  if (!customer) throw notFound('Customer not found');

  await Feedback.deleteMany({ customer: customer._id });
  await Customer.findByIdAndDelete(id);

  return customer;
}

/**
 * @route   POST /api/customers
 * @desc    Create a new customer
 */
const createCustomer = async (req, res, next) => {
  try {
    const customer = await executeCreateCustomer(req.body);

    await auditService.record({
      req,
      collectionName: 'Customer',
      documentId: customer._id,
      action: 'create',
      after: customer.toObject(),
    });

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
    const { customer, beforeSnapshot } = await executeUpdateCustomer(req.params.id, req.body);

    await auditService.record({
      req,
      collectionName: 'Customer',
      documentId: customer._id,
      action: 'update',
      before: beforeSnapshot,
      after: customer.toObject(),
      watchedFields: CUSTOMER_WATCHED_FIELDS,
    });

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
    const customer = await executeDeleteCustomer(req.params.id);

    await auditService.record({
      req,
      collectionName: 'Customer',
      documentId: customer._id,
      action: 'delete',
      before: customer.toObject(),
    });

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
    const isNew = !customerUser;
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

    await auditService.record({
      req,
      collectionName: 'CustomerUser',
      documentId: customerUser._id,
      action: isNew ? 'create' : 'update',
      before: isNew ? undefined : { status: 'reset' },
      after: { email: customerUser.email, status: customerUser.status },
      watchedFields: isNew ? [] : ['status'],
    });

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
  executeCreateCustomer,
  executeUpdateCustomer,
  executeDeleteCustomer,
  CUSTOMER_WATCHED_FIELDS,
};
