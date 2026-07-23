const crypto = require('crypto');
const Customer = require('../models/Customer');
const Feedback = require('../models/Feedback');
const CustomerUser = require('../models/CustomerUser');
const CustomerEvent = require('../models/CustomerEvent');
const Lead = require('../models/Lead');
const LeadEvent = require('../models/LeadEvent');
const Deal = require('../models/Deal');
const DealEvent = require('../models/DealEvent');
const Quote = require('../models/Quote');
const QuoteEvent = require('../models/QuoteEvent');
const auditService = require('../utils/auditService');
const { calculatePriority } = require('../utils/revenueImpact');
const escapeRegex = require('../utils/escapeRegex');
const { buildTimeline } = require('../utils/customerTimeline');
const { PERMISSIONS } = require('../config/permissions');

const CUSTOMER_WATCHED_FIELDS = ['name', 'email', 'company', 'plan', 'mrr', 'source', 'notes'];

const notFound = (message) => Object.assign(new Error(message), { statusCode: 404 });

/**
 * @route   GET /api/customers
 * @desc    Get all customers (with pagination, filtering, sorting)
 */
const getCustomers = async (req, res, next) => {
  try {
    const { plan, source, mrrRange, search, sort = '-mrr', page = 1, limit = 20 } = req.query;

    const filter = {};
    if (plan) filter.plan = plan;
    if (source) filter.source = source;
    if (mrrRange) {
      if (mrrRange === 'free') filter.mrr = 0;
      else if (mrrRange === 'low') filter.mrr = { $gt: 0, $lt: 200 };
      else if (mrrRange === 'high') filter.mrr = { $gte: 200 };
    }
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

// Timeline'ın "created"/"plan_changed" sistem olayları — gevşek tutarlılık
// (leadController.js:38 felsefesi): CustomerEvent yazımı hata verse bile ana
// Customer işlemi geri alınmaz, bu yüzden execute* fonksiyonlarını bloklamaz.
// AuditLog'a DEĞİL buraya: AuditLog hash-zincirli güvenlik izi, bu ise
// müşteri-görünür operasyonel timeline (LeadEvent/AuditLog ayrımıyla aynı
// gerekçe — bkz. tasarım spec'i §3.4).
async function recordSystemEvent(payload) {
  try {
    await CustomerEvent.create(payload);
  } catch {
    // Sessizce yut — timeline ikincil, ana kayıt kaybolmamalı.
  }
}

async function executeCreateCustomer(payload) {
  const customer = await Customer.create(payload);
  await recordSystemEvent({
    customer: customer._id,
    actor: null,
    actorName: 'Sistem',
    action: 'created',
  });
  return customer;
}

async function executeUpdateCustomer(id, payload, actor = null) {
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

  if (payload.plan !== undefined && payload.plan !== beforeSnapshot.plan) {
    await recordSystemEvent({
      customer: customer._id,
      actor: actor?._id || null,
      actorName: actor?.name || 'Sistem',
      action: 'plan_changed',
      fromPlan: beforeSnapshot.plan,
      toPlan: customer.plan,
    });
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
    const { customer, beforeSnapshot } = await executeUpdateCustomer(req.params.id, req.body, req.user);

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

// Her kaynaktan tek seferde çekilecek üst sınır — v1 hacimleri düşük
// (getLeads/getDeals'in "hepsini çek, client'ta işle" deseniyle uyumlu, bkz.
// tasarım spec'i §3.1). Gerçek server-side sayfalama P4'e bırakıldı.
const TIMELINE_SOURCE_CAP = 200;
const DEFAULT_TIMELINE_LIMIT = 50;

/**
 * @route   GET /api/customers/:id/timeline
 * @desc    Müşterinin birleşik aktivite akışı — DealEvent+LeadEvent+Feedback+
 *          CustomerEvent'i okuma-anında harmanlar (bkz. utils/customerTimeline.js).
 *          Ciro-hassas deal öğeleri yalnız deals.read yetkisi olan roller için
 *          dahil edilir (bkz. tasarım spec'i §3.1, §5) — intern/support timeline'ı
 *          görür ama deal öğelerini görmez.
 */
const getCustomerTimeline = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).select('_id').lean();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_TIMELINE_LIMIT, 100);
    const before = req.query.before ? new Date(req.query.before) : null;

    const canReadDeals = PERMISSIONS.deals.read.includes(req.user.role);
    const canReadQuotes = PERMISSIONS.quotes.read.includes(req.user.role);

    const [customerEvents, feedbacks, leadIds, dealIds, quoteIds] = await Promise.all([
      CustomerEvent.find({ customer: customer._id }).sort('-createdAt').limit(TIMELINE_SOURCE_CAP),
      Feedback.find({ customer: customer._id }).sort('-createdAt').limit(TIMELINE_SOURCE_CAP),
      Lead.find({ linkedCustomer: customer._id }).distinct('_id'),
      canReadDeals ? Deal.find({ customer: customer._id }).distinct('_id') : Promise.resolve([]),
      canReadQuotes ? Quote.find({ customer: customer._id }).distinct('_id') : Promise.resolve([]),
    ]);

    const [leadEvents, dealEvents, quoteEvents] = await Promise.all([
      LeadEvent.find({ lead: { $in: leadIds } })
        .sort('-createdAt')
        .limit(TIMELINE_SOURCE_CAP)
        .populate('lead', 'type'),
      dealIds.length
        ? DealEvent.find({ deal: { $in: dealIds } })
            .sort('-createdAt')
            .limit(TIMELINE_SOURCE_CAP)
            .populate('deal', 'title currency')
        : Promise.resolve([]),
      quoteIds.length
        ? QuoteEvent.find({ quote: { $in: quoteIds } })
            .sort('-createdAt')
            .limit(TIMELINE_SOURCE_CAP)
            .populate('quote', 'quoteNumber grandTotal currency')
        : Promise.resolve([]),
    ]);

    let items = buildTimeline({ customerEvents, dealEvents, leadEvents, quoteEvents, feedbacks });

    if (before) {
      items = items.filter((item) => new Date(item.at).getTime() < before.getTime());
    }

    const hasMore = items.length > limit;
    const page = items.slice(0, limit);
    const nextCursor = hasMore ? page[page.length - 1].at : null;

    res.json({
      success: true,
      data: { items: page, hasMore, nextCursor },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/customers/:id/activities
 * @desc    Temsilcinin elle eklediği etkileşim kaydı (not/arama/toplantı/
 *          e-posta) — LeadEvent deseni: actor manuel türlerde her zaman
 *          authed bir personelden gelir (bkz. tasarım spec'i §3.2).
 */
const logCustomerActivity = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).select('_id').lean();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const { type, note } = req.body;

    const event = await CustomerEvent.create({
      customer: customer._id,
      actor: req.user._id,
      actorName: req.user.name,
      action: type,
      note: note || null,
    });

    const [item] = buildTimeline({ customerEvents: [event] });

    res.status(201).json({ success: true, data: item });
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
  getCustomerTimeline,
  logCustomerActivity,
  executeCreateCustomer,
  executeUpdateCustomer,
  executeDeleteCustomer,
  CUSTOMER_WATCHED_FIELDS,
};
