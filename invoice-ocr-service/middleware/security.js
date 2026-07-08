const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

/**
 * Applies baseline security middleware (helmet, restricted CORS, rate limiting,
 * NoSQL injection sanitization, HTTP param pollution guard) to an Express app.
 * Shared shape across backend, invoice-ocr-service, and invoice-ocr-v2.
 */
function applySecurity(app, { frontendUrl }) {
  app.use(helmet());

  app.use(
    cors({
      origin: frontendUrl || 'http://localhost:5173',
      credentials: true,
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.' },
    })
  );

  app.use(mongoSanitize());
  app.use(hpp());
}

module.exports = { applySecurity };
