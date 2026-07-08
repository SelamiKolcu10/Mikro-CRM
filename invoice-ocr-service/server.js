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
    console.log(`✅ Invoice Service — MongoDB Connected: ${conn.connection.host}`);
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

// Uploaded invoice files require a valid session — not publicly browsable
app.use('/uploads', protect, express.static('uploads'));

// API Routes
app.use('/api/invoices', require('./routes/invoiceRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    service: 'invoice-ocr-service',
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Central error handler (must be after routes)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🧾 Invoice OCR Service running on port ${config.port}`);
  console.log(`📡 API available at http://localhost:${config.port}/api`);
});
