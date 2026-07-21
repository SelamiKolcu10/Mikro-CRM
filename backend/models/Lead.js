const mongoose = require('mongoose');
const { LEAD_TYPES, BUDGET_RANGES, TIMEFRAMES, LEAD_STATUSES, LEAD_TEMPERATURES } = require('../config/leads');

/**
 * Public talep formundan gelen ham kayıt — bkz. docs/superpowers/specs/
 * 2026-07-21-lead-intake-forms-design.md §1. `Feedback`'ten kasıtlı olarak
 * ayrı: Feedback zaten müşteri olan biri hakkında (customer required),
 * Lead ise müşteri ilişkisi kurulmadan ÖNCEKİ aşama (linkedCustomer opsiyonel).
 */
const leadSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: { values: LEAD_TYPES, message: 'Geçersiz talep türü.' },
      required: [true, 'Talep türü zorunludur.'],
    },
    name: {
      type: String,
      required: [true, 'Ad soyad zorunludur.'],
      trim: true,
      maxlength: [100, 'Ad soyad en fazla 100 karakter olabilir.'],
    },
    email: {
      type: String,
      required: [true, 'E-posta zorunludur.'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Geçerli bir e-posta girin.'],
    },
    phone: { type: String, trim: true, maxlength: [30, 'Telefon en fazla 30 karakter olabilir.'], default: '' },
    company: { type: String, trim: true, maxlength: [120, 'Şirket adı en fazla 120 karakter olabilir.'], default: '' },
    // Sadece type='quote' iken anlamlı — diğer tiplerde null kalır (bkz. leadValidators).
    budgetRange: { type: String, enum: { values: BUDGET_RANGES, message: 'Geçersiz bütçe aralığı.' }, default: null },
    timeframe: { type: String, enum: { values: TIMEFRAMES, message: 'Geçersiz zaman aralığı.' }, default: null },
    message: {
      type: String,
      required: [true, 'Talep metni zorunludur.'],
      trim: true,
      maxlength: [4000, 'Talep metni en fazla 4000 karakter olabilir.'],
    },
    // Kural-tabanlı, deterministik skor — ingestion anında hesaplanıp
    // saklanır (bkz. utils/leadScoring.js). Project.progress'in tersine:
    // burada canlı bir türev değil, lead'in kendi statik alanlarından
    // tek seferlik bir hesap — yeniden hesaplamak için okuma başına maliyet
    // ödemenin bir faydası yok.
    score: { type: Number, default: 0 },
    temperature: { type: String, enum: LEAD_TEMPERATURES, default: 'cold' },
    status: { type: String, enum: { values: LEAD_STATUSES, message: 'Geçersiz durum.' }, default: 'new' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Email eşleşirse otomatik bağlanır (bkz. §8) — yeni Customer oluşturmaz,
    // sadece referans kurar.
    linkedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    // Sunucuda türetilir (Referer header), istemciden asla kabul edilmez.
    source: { type: String, default: '' },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    // Onaysız kayıt hiç oluşmaz (bkz. leadValidators) — bu yüzden required.
    kvkkConsentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ temperature: 1 });
leadSchema.index({ email: 1 });

module.exports = mongoose.model('Lead', leadSchema);
