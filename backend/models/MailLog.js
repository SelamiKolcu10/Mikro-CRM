const mongoose = require('mongoose');

// 'mocked'  : sağlayıcı mock — gerçekten gönderilmedi, sadece kaydedildi
// 'sent'    : SMTP kabul etti
// 'failed'  : gönderim hata verdi (error alanına bakın)
// 'skipped' : bayrak kapalı ya da kullanıcı bu tür için mail istemiyor
const MAIL_STATUSES = ['mocked', 'sent', 'failed', 'skipped'];

/**
 * Giden e-posta kaydı — "Mail Gönderimleri" ekranının kaynağı.
 *
 * Neden her deneme kaydediliyor (mock/skipped dahil): mail gerçekten
 * gönderilmeye başlandığında "kime ne gitti, ne zaman, neden gitmedi"
 * sorusunun tek cevabı bu koleksiyon olacak. Mock modda da yazıldığı için
 * sistem canlıya alınmadan önce şablonlar ve tetikleyiciler burada
 * doğrulanabiliyor — gerçek posta kutusu kirletmeden.
 *
 * `html` bilerek saklanıyor: şablon değişikliklerinin sonucu ancak
 * gönderilen gövdeye bakılarak görülebiliyor.
 */
const mailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    // Gövde uzun olabilir; listede kısaltılmış gösterilir, detayda tamamı.
    html: { type: String, default: '' },
    text: { type: String, default: '' },

    // Bu mailin hangi olaydan doğduğu — Notification.type ile aynı sözlük.
    kind: { type: String, default: null },

    status: { type: String, enum: MAIL_STATUSES, required: true },
    // 'mock' | 'smtp' — kaydın hangi sağlayıcıyla üretildiği.
    provider: { type: String, required: true },
    // skipped/failed için sebep.
    reason: { type: String, default: null },
    error: { type: String, default: null },
    // SMTP'nin döndürdüğü mesaj kimliği (yalnız gerçek gönderimde).
    messageId: { type: String, default: null },

    // İlgili kullanıcı — "bu kişiye hangi mailler gitti" sorgusu için.
    recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

mailLogSchema.index({ createdAt: -1 });
mailLogSchema.index({ status: 1, createdAt: -1 });
mailLogSchema.index({ recipientUser: 1, createdAt: -1 });

module.exports = mongoose.model('MailLog', mailLogSchema);
