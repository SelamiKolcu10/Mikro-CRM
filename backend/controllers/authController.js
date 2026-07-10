const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CustomerUser = require('../models/CustomerUser');
const auditService = require('../utils/auditService');

// Generate JWT token — role/status claims let the invoice microservices verify
// authorization without a DB lookup; aud:'internal' separates this from the
// customer-portal token audience below.
const generateInternalToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      // Snapshot of User.tokenVersion at issue time — invoice-ocr-service/v2
      // compare this against the live DB value on every request instead of
      // trusting role/status for the token's full 7-day lifetime. See
      // userController.js for where this gets bumped.
      tokenVersion: user.tokenVersion || 0,
      aud: 'internal',
    },
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
      if (user.isLocked()) {
        return res.status(403).json({
          success: false,
          error: 'Çok fazla başarısız deneme nedeniyle hesabınız geçici olarak kilitlendi. 15 dakika sonra tekrar deneyin.',
        });
      }

      if (!(await user.matchPassword(password))) {
        await user.registerFailedLogin();
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      await user.registerSuccessfulLogin();

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
          mustChangePassword: user.mustChangePassword,
          token: generateInternalToken(user),
        },
      });
    }

    // Not a staff account — check the customer portal.
    const customerUser = await CustomerUser.findOne({ email })
      .select('+password')
      .populate('customer', 'name email company plan mrr');

    if (customerUser) {
      if (customerUser.isLocked()) {
        return res.status(403).json({
          success: false,
          error: 'Çok fazla başarısız deneme nedeniyle hesabınız geçici olarak kilitlendi. 15 dakika sonra tekrar deneyin.',
        });
      }

      if (!(await customerUser.matchPassword(password))) {
        await customerUser.registerFailedLogin();
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }

      if (customerUser.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Portal erişiminiz devre dışı bırakılmış.' });
      }

      customerUser.failedLoginAttempts = 0;
      customerUser.lockUntil = null;
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

/**
 * @route   PATCH /api/auth/change-password
 * @desc    Staff self-service password change — also the exit path for the
 *          forced first-login change (mustChangePassword). Runs behind
 *          `identify`, not `protect`, so it stays reachable even while
 *          `protect` is blocking every other route for this account. Issues
 *          a fresh token so the frontend doesn't need to force a re-login to
 *          pick up the cleared mustChangePassword claim.
 */
const changePassword = async (req, res, next) => {
  try {
    if (req.accountType !== 'internal') {
      return res.status(403).json({ success: false, error: 'Bu işlem yalnızca personel hesapları içindir.' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Mevcut ve yeni şifre gereklidir.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Yeni şifre en az 8 karakter olmalıdır.' });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, error: 'Mevcut şifre yanlış.' });
    }

    const wasForced = user.mustChangePassword;
    user.password = newPassword;
    user.mustChangePassword = false;
    user.bumpTokenVersion(); // a password change should kill any other token in the wild too
    await user.save();

    await auditService.record({
      req,
      collectionName: 'User',
      documentId: user._id,
      action: 'update',
      before: { password: 'old', mustChangePassword: wasForced },
      after: { password: 'new', mustChangePassword: false },
      watchedFields: ['password', 'mustChangePassword'],
    });

    res.json({
      success: true,
      message: 'Şifreniz güncellendi.',
      data: { token: generateInternalToken(user) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, getMe, changePassword };
