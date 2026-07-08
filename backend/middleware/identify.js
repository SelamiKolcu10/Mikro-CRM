const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CustomerUser = require('../models/CustomerUser');

/**
 * Unified "who is this" check for the single login entry point. Reads the
 * token's `aud` claim to decide which collection to look the account up in,
 * then attaches a consistent `req.accountType` ('internal' | 'customer') so
 * a single /api/auth/me can serve both staff and customer sessions.
 *
 * This does NOT replace `protect` / `protectPortal` — those still guard the
 * resource routes with their own audience checks. This middleware exists
 * only for the shared login/me flow.
 */
const identify = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authorized — no token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.aud === 'internal') {
      const user = await User.findById(decoded.id);
      if (!user || user.status !== 'approved') {
        return res.status(401).json({ success: false, error: 'Not authorized' });
      }
      req.accountType = 'internal';
      req.user = user;
      return next();
    }

    if (decoded.aud === 'portal') {
      const customerUser = await CustomerUser.findById(decoded.id).populate('customer', 'name email company plan mrr');
      if (!customerUser || customerUser.status !== 'active') {
        return res.status(401).json({ success: false, error: 'Not authorized' });
      }
      req.accountType = 'customer';
      req.customerUser = customerUser;
      return next();
    }

    return res.status(401).json({ success: false, error: 'Not authorized — invalid token audience' });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Not authorized — invalid token' });
  }
};

module.exports = { identify };
