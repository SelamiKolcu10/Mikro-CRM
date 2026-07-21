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

  app.use(
    helmet({
      // This is a JSON-only API (no HTML/inline scripts served), so a strict
      // default-src is safe. connect-src explicitly allows ws/wss to the
      // frontend origin for the Socket.io chat layer.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", origin, origin.replace(/^http/, 'ws')],
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
      windowMs: 15 * 60 * 1000, // 15 dakika
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin.' },
    })
  );

  app.use(mongoSanitize());
  app.use(hpp());
}

/**
 * Sıkı rate limiter — login/register gibi kaba kuvvet (brute-force) riski taşıyan
 * endpoint'lere ek olarak uygulanır.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Yalnızca BAŞARISIZ girişleri say — brute-force koruması aynen kalır
  // (yanlış şifre denemeleri 15dk/20 ile sınırlı) ama doğru girişler kotayı
  // yakmaz. Böylece çok sayıda geçerli hesaba (ör. test müşterileri) arka
  // arkaya girmek limite takılmaz. login controller başarılı girişte 2xx,
  // başarısızda 401 döndüğünden bu ayrım güvenilir çalışır.
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Çok fazla giriş denemesi, lütfen 15 dakika sonra tekrar deneyin.' },
});

/**
 * Public lead-intake endpoint'i (POST /api/leads) için — bu, uygulamadaki
 * ilk gerçekten anonim (auth'suz) yüzey, o yüzden global limitten (15dk/300)
 * çok daha sıkı, dakika bazlı kendi limiti var. Honeypot + validasyonla
 * birlikte katmanlı spam savunmasının bir parçası (bkz. spec §3).
 */
const leadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Çok fazla talep gönderildi, lütfen bir dakika sonra tekrar deneyin.' },
});

module.exports = { applySecurity, authRateLimiter, leadRateLimiter };
