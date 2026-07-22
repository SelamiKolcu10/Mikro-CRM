const mongoose = require('mongoose');
const { QUOTE_STATUSES } = require('../config/quotes');
const { CATALOG_CURRENCIES, DEFAULT_TAX_RATE } = require('../config/catalog');

/**
 * Teklif satır kalemi alt-şeması. _id: true — satır düzenlemesi için id lazım.
 * Katalog ürünü snapshot'lanır (fiyat/KDV/isim ekleme anında kopyalanır) veya
 * serbest satır olarak girilir. Toplamlar SAKLANMAZ, hesaplanır (utils/quoteTotals.js).
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md §1.5
 */
const quoteItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CatalogProduct',
    default: null,
  },
  name: {
    type: String,
    required: [true, 'Kalem adı zorunludur.'],
    maxlength: [150, 'Kalem adı en fazla 150 karakter olabilir.'],
  },
  description: {
    type: String,
    default: '',
  },
  quantity: {
    type: Number,
    required: [true, 'Miktar zorunludur.'],
    min: [0, 'Miktar negatif olamaz.'],
  },
  unitPrice: {
    type: Number,
    required: [true, 'Birim fiyat zorunludur.'],
    min: [0, 'Fiyat negatif olamaz.'],
  },
  taxRate: {
    type: Number,
    min: [0, 'KDV oranı 0-100 arasında olmalıdır.'],
    max: [100, 'KDV oranı 0-100 arasında olmalıdır.'],
    default: DEFAULT_TAX_RATE,
  },
  discountRate: {
    type: Number,
    min: [0, 'İndirim oranı 0-100 arasında olmalıdır.'],
    max: [100, 'İndirim oranı 0-100 arasında olmalıdır.'],
    default: 0,
  },
});

/**
 * Teklif (Quote) — müşteriye kesilen teklif belgesi. Katalog ürünlerinden veya
 * serbest kalemlerden oluşur. Toplamlar her okumada hesaplanır (drift yok).
 * Durumlar: draft→sent (P3a); accepted/rejected/expired geçişleri P3b'de.
 */
const quoteSchema = new mongoose.Schema(
  {
    quoteNumber: {
      type: String,
      unique: true,
      required: [true, 'Teklif numarası zorunludur.'],
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Müşteri zorunludur.'],
    },
    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sorumlu zorunludur.'],
    },
    status: {
      type: String,
      enum: { values: QUOTE_STATUSES, message: 'Geçersiz teklif durumu.' },
      default: 'draft',
    },
    currency: {
      type: String,
      enum: { values: CATALOG_CURRENCIES, message: 'Geçersiz para birimi.' },
      default: 'TRY',
    },
    validUntil: {
      type: Date,
      default: null,
    },
    items: {
      type: [quoteItemSchema],
      validate: {
        validator: (v) => v && v.length > 0,
        message: 'En az bir kalem eklenmelidir.',
      },
    },
    notes: {
      type: String,
      default: '',
      maxlength: [2000, 'Notlar en fazla 2000 karakter olabilir.'],
    },
    version: {
      type: Number,
      default: 1,
    },
    supersedes: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quote',
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    // P3b Onay Akışı alanları
    publicToken: {
      type: String,
      unique: true,
      sparse: true, // Sadece gönderilmiş tekliflerde bulunur
      index: true,
    },
    publicViewedAt: {
      type: Date,
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: '',
      maxlength: [1000, 'Red nedeni en fazla 1000 karakter olabilir.'],
    },
    // Faturaya dönüştürüldüyse fatura referansı
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
  },
  {
    timestamps: true,
    // Eşzamanlı düzenleme çakışması → 409 (Deal/Task deseni).
    optimisticConcurrency: true,
  }
);

quoteSchema.index({ customer: 1, createdAt: -1 });
quoteSchema.index({ deal: 1 });
quoteSchema.index({ status: 1 });

module.exports = mongoose.model('Quote', quoteSchema);
