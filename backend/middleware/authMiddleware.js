const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — verify JWT token from Authorization header.
 * Attaches the authenticated user to req.user.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized — no token provided',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request (exclude password)
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized — user not found',
      });
    }

    // req.user.role/status below are already always live (fetched fresh
    // above), so this check doesn't change authorization outcomes on this
    // service — it exists so a bare password change (which doesn't touch
    // role/status) still kills a stolen token immediately, and so a
    // super_admin has one explicit signal ("stale token") to hand a user
    // rather than a generic 401 when something upstream revoked them.
    if ((decoded.tokenVersion || 0) !== (req.user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        error: 'Oturumunuz geçersiz kılındı. Lütfen tekrar giriş yapın.',
        code: 'TOKEN_REVOKED',
      });
    }

    if (req.user.status !== 'approved') {
      return res.status(403).json({
        success: false,
        error:
          req.user.status === 'pending'
            ? 'Hesabınız henüz onaylanmadı. Lütfen yöneticinizin onayını bekleyin.'
            : 'Hesabınız reddedildi.',
      });
    }

    // Blocks every route guarded by `protect` until the account changes its
    // temporary password. The change-password endpoint itself runs behind
    // `identify` instead, so it stays reachable while this is in effect.
    if (req.user.mustChangePassword) {
      return res.status(403).json({
        success: false,
        error: 'Devam etmeden önce şifrenizi değiştirmeniz gerekiyor.',
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized — invalid token',
    });
  }
};

module.exports = { protect };
