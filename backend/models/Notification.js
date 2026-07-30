const mongoose = require('mongoose');

// Bildirim türleri. Yeni bir tür eklerken burayı VE
// services/notificationService.js'i birlikte güncelle — tür, istemcinin
// ikon/yönlendirme seçiminde kullanılıyor.
const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'TASK_STATUS_CHANGED',
  'TASK_COMMENT',
  'APPROVAL_DECIDED',
  'QUOTE_EVENT',
];

/**
 * Kullanıcıya özel bildirim kaydı.
 *
 * Neden hem DB'ye yazılıp hem socket'e yayınlanıyor: socket yalnız o an bağlı
 * olan kullanıcıya ulaşır. Kullanıcı çevrimdışıysa yayın boşa gider, kayıt ise
 * kalır ve giriş yaptığında okunmamış olarak görünür. İkisi birbirinin yedeği
 * değil, iki farklı kanal (bkz. services/notificationService.js).
 *
 * `title`/`message` YAZILDIĞI ANDA sabitlenir — kaynak kayıt sonradan
 * değişse/silinse bile bildirim metni o günkü gerçeği anlatmaya devam eder.
 * Bu yüzden bilerek denormalize.
 */
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    // İstemcinin bildirime dokununca nereye gideceği. Web yolu olarak tutulur
    // (ör. '/tasks?id=...'); mobil kendi navigasyonuna `meta` üzerinden çevirir.
    link: {
      type: String,
      default: null,
    },
    // Yönlendirme için gereken ham kimlikler — link'i ayrıştırmak zorunda
    // kalmamak için. Serbest biçimli: { taskId, projectId, quoteId... }
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Bildirimi tetikleyen kişi (sistem tetiklediyse null).
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Ana sorgu: "bu kullanıcının bildirimleri, yeniden eskiye".
notificationSchema.index({ recipient: 1, createdAt: -1 });
// Çan rozeti: "bu kullanıcının okunmamış sayısı".
notificationSchema.index({ recipient: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
