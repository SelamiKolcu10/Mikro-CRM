const jwt = require('jsonwebtoken');

/**
 * Lightweight JWT verification for this microservice — no DB lookup (this
 * service has no User collection). Trusts the role/status claims embedded in
 * the token by the main backend at login time. Requires JWT_SECRET to be
 * IDENTICAL to backend/.env and invoice-ocr-v2/.env.
 */
const protect = (req, res, next) => {
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

    if (decoded.status !== 'approved') {
      return res.status(403).json({ success: false, error: 'Hesabınız henüz onaylanmadı.' });
    }

    req.user = { id: decoded.id, role: decoded.role, status: decoded.status };
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
