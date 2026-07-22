const { getIO, STAFF_ROOM } = require('../socket');

/**
 * Socket.io üzerinden teklif durum değişikliklerini (görüntülendi, kabul edildi, reddedildi)
 * personele (STAFF_ROOM) anlık bildirim olarak yayınlar.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-approval-invoice-p3b-design.md §1.4
 */
function notifyQuoteEvent(event, quote) {
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
