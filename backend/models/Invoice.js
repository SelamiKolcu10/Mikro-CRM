const mongoose = require('mongoose');

/**
 * Satış Faturası (Sales Invoice) Modeli.
 * Onaylanmış tekliften doğrudan dönüştürülebilir ya da bağımsız oluşturulabilir.
 * Fatura Numarası formatı: FTR-2026-0001 (Counter atomik sıralı).
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-approval-invoice-p3b-design.md §1.3
 */
const invoiceItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CatalogProduct',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Kalem adı zorunludur.'],
      trim: true,
      maxlength: [150, 'Kalem adı en fazla 150 karakter olabilir.'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'Açıklama en fazla 1000 karakter olabilir.'],
    },
    quantity: {
      type: Number,
      required: [true, 'Miktar zorunludur.'],
      min: [0.01, 'Miktar 0\'dan büyük olmalıdır.'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Birim fiyat zorunludur.'],
      min: [0, 'Birim fiyat negatif olamaz.'],
    },
    taxRate: {
      type: Number,
      required: [true, 'KDV oranı zorunludur.'],
      min: [0, 'KDV negatif olamaz.'],
      max: [100, 'KDV %100\'den büyük olamaz.'],
      default: 20,
    },
    discountRate: {
      type: Number,
      min: [0, 'İndirim negatif olamaz.'],
      max: [100, 'İndirim %100\'den büyük olamaz.'],
      default: 0,
    },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    quote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quote',
      default: null,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Müşteri zorunludur.'],
      index: true,
    },
    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'issued', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
      index: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    currency: {
      type: String,
      enum: ['TRY', 'USD', 'EUR', 'GBP'],
      default: 'TRY',
    },
    items: {
      type: [invoiceItemSchema],
      validate: [
        (val) => Array.isArray(val) && val.length > 0,
        'Faturada en az bir kalem bulunmalıdır.',
      ],
    },
    notes: {
      type: String,
      default: '',
      maxlength: [2000, 'Notlar en fazla 2000 karakter olabilir.'],
    },
    paymentNotes: {
      type: String,
      default: '',
      maxlength: [1000, 'Ödeme notları en fazla 1000 karakter olabilir.'],
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

invoiceSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
