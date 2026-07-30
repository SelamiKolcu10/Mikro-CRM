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
  const origin = frontendUrl || 'http://localhost:5173';

  // Bkz. backend/middleware/security.js — aynı gerekçe. Varsayılan KAPALI:
  // vekil yokken açmak istemcinin X-Forwarded-For uydurup rate limit'i
  // atlatmasına izin verir. Değer = güvenilen vekil sayısı.
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
  }

  // Bkz. backend/middleware/security.js — aynı gerekçe ve aynı davranış.
  if (process.env.NODE_ENV === 'production') {
    if (!/^https:\/\//i.test(origin)) {
      console.error(`❌ NODE_ENV=production iken FRONTEND_URL https olmalı (şu an: ${origin}).`);
      process.exit(1);
    }
    if (process.env.TRUST_PROXY) {
      app.use((req, res, next) => {
        if (req.secure) return next();
        return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
      });
    }
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", origin],
          imgSrc: ["'self'", 'data:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    })
  );

  app.use(
    cors({
      origin,
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
