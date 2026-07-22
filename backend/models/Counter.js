const mongoose = require('mongoose');

/**
 * Genel amaçlı atomik sayaç — teklif numarası (TKF-2026-0001) ve fatura
 * numarası (FTR-2026-0001) yarış-koşulsuz üretmek için. AuditSequenceCounter'ı
 * KULLANMA — o hash-zincirine özel. Bu ayrı, genel primitif.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md §1.4
 */
const counterSchema = new mongoose.Schema({
  _id: String,        // örn. 'quote-2026', 'invoice-2026'
  seq: { type: Number, default: 0 },
});

/**
 * Atomik artır + döndür. Upsert sayesinde ilk çağrıda bile güvenli;
 * findByIdAndUpdate mongosu donanım atomik ($inc) olduğundan yarış koşulu yok.
 * @param {string} key - sayaç anahtarı (örn. 'quote-2026')
 * @returns {number} yeni sıra numarası
 */
counterSchema.statics.next = async function (key) {
  const doc = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
