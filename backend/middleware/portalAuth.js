const jwt = require('jsonwebtoken');
const CustomerUser = require('../models/CustomerUser');

/**
 * Protects portal (customer-facing) routes. Deliberately separate from the
 * internal `protect` middleware — checks aud:'portal' so an internal staff
 * token can never be replayed against portal endpoints and vice versa.
 */
const protectPortal = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authorized — no token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.aud !== 'portal') {
      return res.status(401).json({ success: false, error: 'Not authorized — invalid token audience' });
    }

    const customerUser = await CustomerUser.findById(decoded.id);

    if (!customerUser || customerUser.status !== 'active') {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    // Reject tokens issued before the last password change (revocation).
    // Tokens minted before this field existed carry no claim → `|| 0`, which
    // matches the default, so pre-existing sessions keep working.
    if ((decoded.tokenVersion || 0) !== (customerUser.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        error: 'Oturumunuz geçersiz kılındı. Lütfen tekrar giriş yapın.',
        code: 'TOKEN_REVOKED',
      });
    }

    req.customerUser = customerUser;
    req.customerId = customerUser.customer;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Not authorized — invalid token' });
  }
};

module.exports = { protectPortal };
