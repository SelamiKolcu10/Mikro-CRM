const { getIO, STAFF_ROOM } = require('../socket');
const notificationService = require('../services/notificationService');

/**
 * Teklif durum değişikliklerini (görüntülendi, kabul edildi, reddedildi)
 * personele duyurur.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-approval-invoice-p3b-design.md §1.4
 *
 * İKİ KANAL:
 *  1. Kalıcı bildirim — teklifin SAHİBİNE (quote.owner). Asıl kanal budur.
 *  2. STAFF_ROOM canlı yayını — geriye dönük uyumluluk için korunuyor.
 *
 * Neden 1. kanal eklendi: STAFF_ROOM sohbet kapsamlı (bkz. socket/index.js
 * canChat), yani `accountant` o odaya hiç girmiyor — teklif ve fatura onun
 * işi olduğu halde hiçbir şey alamıyordu. Ayrıca o olayları dinleyen bir
 * istemci kodu ne webde ne mobilde vardı, yayın boşa gidiyordu.
 *
 * 2. kanal neden silinmedi: ileride bir "canlı akış" ekranı bu olayları
 * dinlemek isteyebilir ve yayının maliyeti yok. Ama artık tek başına
 * yeterli DEĞİL — kalıcı kayıt 1. kanalda üretiliyor.
 */
async function notifyQuoteEvent(event, quote) {
  // Kalıcı bildirim. notificationService kendi hatalarını yutuyor, ama
  // teklif akışını hiçbir koşulda bozmamak için burada da sarmalıyoruz.
  try {
    await notificationService.quoteEvent({ event, quote });
  } catch (err) {
    console.error('Quote notification error:', err.message);
  }

  try {
    const io = getIO();
    if (!io) return;

    const payload = {
      event, // 'quote:viewed' | 'quote:accepted' | 'quote:rejected'
      quoteId: quote._id,
      quoteNumber: quote.quoteNumber,
      customerName: quote.customer?.name || quote.customer?.company || 'Müşteri',
      amount: quote.grandTotal,
      currency: quote.currency,
      timestamp: new Date(),
    };

    io.to(STAFF_ROOM).emit(event, payload);
  } catch (err) {
    // Socket yayını hata verirse ana akış bozulmasın
    console.error('Quote socket notification error:', err.message);
  }
}

module.exports = { notifyQuoteEvent };
