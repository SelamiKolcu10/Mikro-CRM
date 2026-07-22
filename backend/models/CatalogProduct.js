const mongoose = require('mongoose');
const { PRODUCT_UNITS, DEFAULT_TAX_RATE, CATALOG_CURRENCIES } = require('../config/catalog');

/**
 * Ürün Kataloğu — standart ürün/hizmet tanımları. Teklif oluşturulurken buradan
 * seçilir ve fiyat/KDV teklife snapshot'lanır. Silme semantiği: hard delete YOK;
 * active:false ile arşivlenir (bkz. [[no-uncontrolled-deletes]] ruhu). Teklifler
 * ürünü snapshot'ladığı için veri bütünlüğü riski yok.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md §1.3
 */
const catalogProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ürün adı zorunludur.'],
      trim: true,
      maxlength: [150, 'Ürün adı en fazla 150 karakter olabilir.'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'Açıklama en fazla 1000 karakter olabilir.'],
    },
    sku: {
      type: String,
      default: '',
      trim: true,
      // Opsiyonel stok kodu; v1'de unique DEĞİL (sürtünme azaltır)
    },
    unitPrice: {
      type: Number,
      required: [true, 'Birim fiyat zorunludur.'],
      min: [0, 'Fiyat negatif olamaz.'],
    },
    currency: {
      type: String,
      enum: { values: CATALOG_CURRENCIES, message: 'Geçersiz para birimi.' },
      default: 'TRY',
    },
    taxRate: {
      type: Number,
      min: [0, 'KDV oranı 0-100 arasında olmalıdır.'],
      max: [100, 'KDV oranı 0-100 arasında olmalıdır.'],
      default: DEFAULT_TAX_RATE,
    },
    unit: {
      type: String,
      enum: { values: PRODUCT_UNITS, message: 'Geçersiz birim.' },
      default: 'piece',
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    // Soft-arşiv: DELETE = active:false. Silmek yerine pasifle.
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

catalogProductSchema.index({ active: 1, category: 1 });
catalogProductSchema.index({ name: 1 });

module.exports = mongoose.model('CatalogProduct', catalogProductSchema);
