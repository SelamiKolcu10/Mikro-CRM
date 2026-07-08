const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  description: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  baseAmount: { type: Number, required: true },
  vatRate: { type: Number, required: true },
  vatAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
}, { _id: false });

const vatSummarySchema = new mongoose.Schema({
  vatRate: { type: Number, required: true },
  totalBase: { type: Number, required: true },
  totalVat: { type: Number, required: true },
  totalWithVat: { type: Number, required: true },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  // Vendor Information
  vendorName: { type: String, default: '' },
  vendorTaxNumber: { type: String, default: '' },
  invoiceNumber: { type: String, default: '' },
  invoiceDate: { type: Date, default: null },

  // Line-item VAT Breakdown
  lineItems: [lineItemSchema],

  // Aggregated VAT Group Summaries
  vatSummary: [vatSummarySchema],

  // Totals
  totalBase: { type: Number, default: 0 },
  totalVat: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  // Validation
  validationStatus: {
    type: String,
    enum: ['verified', 'mismatch', 'pending'],
    default: 'pending',
  },
  validationMessage: { type: String, default: null },
  confidenceScore: { type: Number, default: 0, min: 0, max: 100 },

  // File Info
  originalFileName: { type: String, default: '' },
  fileUrl: { type: String, default: '' },

  // Optional CRM link
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
  },

  // Which OCR engine processed this invoice
  ocrEngine: {
    type: String,
    enum: ['tesseract-v2', 'openai-v1'],
    default: 'tesseract-v2',
  },
}, {
  timestamps: true,
});

// Index for common queries
invoiceSchema.index({ validationStatus: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ createdAt: -1 });

// Explicit collection name so v2 never shares v1's `invoices` collection
module.exports = mongoose.model('Invoice', invoiceSchema, 'invoicesv2');
