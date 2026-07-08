const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

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

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

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
