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

  // Ters vekil (nginx/Cloudflare/Render...) arkasında çalışırken Express'in
  // gerçek istemci IP'sini X-Forwarded-For'dan okuması gerekir; yoksa
  // express-rate-limit TÜM istekleri vekilin tek IP'si sanar ve bir kullanıcı
  // herkesin kotasını yakar.
  //
  // Bilerek env ile açılıyor, varsayılan KAPALI: vekil yokken bunu açmak
  // istemcinin kendi X-Forwarded-For başlığını uydurup rate limit'i tamamen
  // atlatmasına izin verir. Değer = güvenilen vekil sayısı (tek vekil için 1).
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
  }

  if (process.env.NODE_ENV === 'production') {
    // FRONTEND_URL aynı zamanda CORS origin'i — http ise tarayıcıya "bu
    // güvensiz kaynağa kimlik bilgisi gönderebilirsin" demiş oluyoruz ve
    // JWT'yi ağda açık taşıyan bir kurulumu kutsuyoruz. JWT_SECRET'te olduğu
    // gibi (bkz. server.js) yanlış yapılandırmayla açılmaktansa açılmamak
    // doğrusu: sessizce güvensiz çalışan bir sunucu en kötü sonuç.
    if (!/^https:\/\//i.test(origin)) {
      console.error(
        `❌ NODE_ENV=production iken FRONTEND_URL https olmalı (şu an: ${origin}).\n` +
          '   Düzeltin ya da yerel çalıştırma için NODE_ENV değerini production dışına alın.'
      );
      process.exit(1);
    }

    if (!process.env.TRUST_PROXY) {
      // Kırmızı çizgi değil ama neredeyse her zaman hatadır: vekil arkasında
      // TRUST_PROXY olmadan rate limit tüm istekleri tek IP sanar.
      console.warn(
        '⚠️  NODE_ENV=production ama TRUST_PROXY tanımsız. Ters vekil arkasındaysanız\n' +
          '   rate limiting gerçek istemci IP\'sini göremez (bkz. .env.example).'
      );
    } else {
      // http→https yönlendirmesi SADECE TRUST_PROXY varken eklenir. `req.secure`
      // vekil başlığını ancak trust proxy açıkken dikkate alır; kapalıyken
      // vekil arkasında her istek "güvensiz" görünür ve sonsuz yönlendirme
      // döngüsü oluşurdu.
      app.use((req, res, next) => {
        if (req.secure) return next();
        return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
      });
    }
  }

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

/**
 * Public teklif endpoint'leri (GET/POST /api/public/quotes/*) için rate limiter.
 * Spam ve brute-force token tahminini engeller (1 dakikada maks 30 istek).
 */
const publicQuoteRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Çok fazla istek gönderildi, lütfen biraz bekleyin.' },
});

module.exports = { applySecurity, authRateLimiter, leadRateLimiter, publicQuoteRateLimiter };

