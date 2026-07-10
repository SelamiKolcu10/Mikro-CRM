const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT verification for this microservice. The main backend's MongoDB is
 * shared with this service (see .env MONGO_URI), so — unlike the original
 * version of this middleware, which trusted role/status/tokenVersion purely
 * from the token for the full 7-day lifetime — this now does one cheap,
 * indexed-by-_id lookup against the live `users` collection on every
 * request to catch a role/status change or password change immediately,
 * instead of waiting for the token to expire or the user to log in again.
 * Requires JWT_SECRET to be IDENTICAL to backend/.env and invoice-ocr-v2/.env.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authorized — no token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.aud !== 'internal') {
      return res.status(401).json({ success: false, error: 'Not authorized — invalid token audience' });
    }

    const liveUser = await User.findById(decoded.id).select('role status mustChangePassword tokenVersion').lean();
    if (!liveUser) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    if ((decoded.tokenVersion || 0) !== (liveUser.tokenVersion || 0)) {
      return res.status(401).json({ success: false, error: 'Oturumunuz geçersiz kılındı. Lütfen tekrar giriş yapın.', code: 'TOKEN_REVOKED' });
    }

    if (liveUser.status !== 'approved') {
      return res.status(403).json({ success: false, error: 'Hesabınız henüz onaylanmadı.' });
    }

    if (liveUser.mustChangePassword) {
      return res.status(403).json({
        success: false,
        error: 'Devam etmeden önce şifrenizi değiştirmeniz gerekiyor.',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    // role comes from the live document, not the token — a demotion is
    // effective on this service immediately, same as the main backend.
    req.user = { id: decoded.id, role: liveUser.role, status: liveUser.status };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Not authorized — invalid token' });
  }
};

/**
 * Restricts a route to the given roles. Must run after `protect`.
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authorized' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok.' });
  }
  next();
};

module.exports = { protect, authorize };
