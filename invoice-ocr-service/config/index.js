const dotenv = require('dotenv');
const path = require('path');

// Load .env from this service's own directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI,
  openaiApiKey: process.env.OPENAI_API_KEY,

  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,
    maxBulkFiles: parseInt(process.env.MAX_BULK_FILES, 10) || 20,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ],
  },

  vat: {
    tolerance: parseFloat(process.env.VAT_TOLERANCE) || 30.00,
  },
};

module.exports = config;
