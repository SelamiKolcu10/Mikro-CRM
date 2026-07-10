const { validationResult } = require('express-validator');

/**
 * Runs after a chain of express-validator checks on a route. Collects all
 * validation errors into one response instead of failing on the first.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: errors.array().map((e) => e.msg).join(' '),
      errors: errors.array(),
    });
  }
  next();
};

module.exports = { handleValidationErrors };
