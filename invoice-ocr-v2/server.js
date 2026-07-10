const express = require('express');
const mongoose = require('mongoose');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const { applySecurity } = require('./middleware/security');
const { protect } = require('./middleware/auth');

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET tanımlı değil — sunucu güvenli başlatılamaz.');
  process.exit(1);
}

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri);
    console.log(`✅ Invoice v2 Service — MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

connectDB();

const app = express();

// Security middleware (helmet, restricted CORS, rate limiting, sanitization)
applySecurity(app, { frontendUrl: process.env.FRONTEND_URL });

app.use(express.json({ limit: '1mb' }));

// Uploaded invoice files require a valid session — not publicly browsable.
// Defense-in-depth alongside middleware/fileSignature.js: even if a
// mismatched file somehow ended up here, forcing download instead of
// inline rendering (Content-Disposition) and disabling MIME-sniffing
// (X-Content-Type-Options) means a browser will never execute it as HTML/JS.
app.use(
  '/uploads',
  protect,
  express.static('uploads', {
    setHeaders: (res) => {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

// API Routes
app.use('/api/invoices', require('./routes/invoiceRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    service: 'invoice-ocr-v2',
    status: 'ok',
    version: '1.0.0',
    engine: 'tesseract.js',
    timestamp: new Date().toISOString(),
  });
});

// Central error handler (must be after routes)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🧾 Invoice OCR v2 (Tesseract) running on port ${config.port}`);
  console.log(`📡 API available at http://localhost:${config.port}/api`);
});
