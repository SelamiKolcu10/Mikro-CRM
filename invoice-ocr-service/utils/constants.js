/**
 * Turkey VAT Rate Constants
 * Official KDV (Katma Değer Vergisi) rates as of 2024
 */

const VAT_RATES = {
  1: {
    label: 'Temel Gıda / Basic Food',
    examples: 'Ekmek, süt, sebze, meyve, bakliyat',
  },
  10: {
    label: 'Gıda & Konaklama / Food & Accommodation',
    examples: 'Restoran, otel, tekstil, ayakkabı',
  },
  20: {
    label: 'Genel Oran / General Rate',
    examples: 'Teknoloji, hizmet, araç, mobilya, elektronik',
  },
};

const VALID_VAT_RATES = Object.keys(VAT_RATES).map(Number);

const VALIDATION_STATUS = {
  VERIFIED: 'verified',
  MISMATCH: 'mismatch',
  PENDING: 'pending',
};

// Allowed file types for invoice uploads
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const MAX_BULK_FILES = 20;

module.exports = {
  VAT_RATES,
  VALID_VAT_RATES,
  VALIDATION_STATUS,
  ALLOWED_MIME_TYPES,
  MAX_BULK_FILES,
};
