/**
 * Teklif durum sabitleri — tek kaynak (bkz. config/deals.js deseni).
 * draft/sent P3a'da; accepted/rejected/expired enum'da TANIMLI ama geçişleri
 * P3b'de. Baştan tanımlı ki sonradan migration gerekmesin.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md §1.2
 */
const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
const QUOTE_EDITABLE_STATUSES = ['draft']; // sadece taslak doğrudan düzenlenir

module.exports = { QUOTE_STATUSES, QUOTE_EDITABLE_STATUSES };
