const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { applySecurity } = require('./middleware/security');

// Load environment variables
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET tanımlı değil — sunucu güvenli başlatılamaz.');
  process.exit(1);
}

// Connect to database
connectDB();

const app = express();

// Security middleware (helmet, restricted CORS, rate limiting, sanitization)
applySecurity(app, { frontendUrl: process.env.FRONTEND_URL });

app.use(express.json({ limit: '1mb' }));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/feedbacks', require('./routes/feedbackRoutes'));
app.use('/api/portal', require('./routes/portalRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/knowledge-base', require('./routes/knowledgeBaseRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Central error handler (must be after routes)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});
