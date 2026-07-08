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

    req.customerUser = customerUser;
    req.customerId = customerUser.customer;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Not authorized — invalid token' });
  }
};

module.exports = { protectPortal };
