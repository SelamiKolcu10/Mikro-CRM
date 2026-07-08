const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CustomerUser = require('../models/CustomerUser');

// Generate JWT token — role/status claims let the invoice microservices verify
// authorization without a DB lookup; aud:'internal' separates this from the
// customer-portal token audience below.
const generateInternalToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, status: user.status, aud: 'internal' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const generatePortalToken = (customerUser) => {
  return jwt.sign(
    { id: customerUser._id, customerId: customerUser.customer, aud: 'portal' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * @route   POST /api/auth/login
 * @desc    Single login entry point for both staff and customers. There is
 *          no separate portal login — an email either belongs to a `User`
 *          (staff) or a `CustomerUser` (customer portal), never both, so we
 *          try internal first and fall back to the portal account. The
 *          response's `accountType` tells the frontend which panel to open.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password',
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (user) {
      if (!(await user.matchPassword(password))) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      if (user.status !== 'approved') {
        return res.status(403).json({
          success: false,
          error:
            user.status === 'pending'
              ? 'Hesabınız henüz onaylanmadı. Lütfen yöneticinizin onayını bekleyin.'
              : 'Hesabınız reddedildi.',
        });
      }

      return res.json({
        success: true,
        data: {
          accountType: 'internal',
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          token: generateInternalToken(user),
        },
      });
    }

    // Not a staff account — check the customer portal.
    const customerUser = await CustomerUser.findOne({ email })
      .select('+password')
      .populate('customer', 'name email company plan mrr');

    if (customerUser) {
      if (!(await customerUser.matchPassword(password))) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      if (customerUser.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Portal erişiminiz devre dışı bırakılmış.' });
      }

      customerUser.lastLoginAt = new Date();
      await customerUser.save();

      return res.json({
        success: true,
        data: {
          accountType: 'customer',
          _id: customerUser._id,
          email: customerUser.email,
          customer: customerUser.customer,
          token: generatePortalToken(customerUser),
        },
      });
    }

    res.status(401).json({ success: false, error: 'Invalid email or password' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Returns whichever account type the token's `aud` claim maps to
 *          (see middleware/identify.js).
 */
const getMe = async (req, res, next) => {
  try {
    if (req.accountType === 'internal') {
      return res.json({ success: true, data: { accountType: 'internal', ...req.user.toObject() } });
    }

    const cu = req.customerUser;
    res.json({
      success: true,
      data: {
        accountType: 'customer',
        _id: cu._id,
        email: cu.email,
        customer: cu.customer,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, getMe };
