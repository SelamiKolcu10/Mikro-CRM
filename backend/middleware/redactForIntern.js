const { ROLES } = require('../config/permissions');
const { redactPII } = require('../utils/redactPII');

/**
 * Sadece intern rolü için: `res.json({..., data})` çağrısındaki `data`
 * alanını göndermeden önce maskeler. Diğer roller hiç etkilenmez — bu route
 * zaten intern dışındaki roller için normal davranır.
 */
const redactForIntern = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.INTERN) {
    return next();
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && Object.prototype.hasOwnProperty.call(body, 'data')) {
      body.data = redactPII(body.data);
    }
    return originalJson(body);
  };
  next();
};

module.exports = { redactForIntern };
