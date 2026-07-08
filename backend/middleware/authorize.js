/**
 * Restricts a route to the given roles. Must run after `protect`.
 * `protect` already guarantees req.user is an approved user (see authMiddleware.js).
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

module.exports = { authorize };
