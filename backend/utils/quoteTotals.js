/**
 * Satır ve teklif toplamlarını hesaplar. Frontend utils/quoteTotals.js ile
 * AYNI formül (senkron tutulacak). Saf fonksiyon, DOM'suz, mobil-taşınabilir.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md §2.3
 *
 * v1 kısıtı: indirim yalnız satır-bazlı; teklif-geneli indirim ileride.
 */

function computeLine(item) {
  const gross = (item.quantity || 0) * (item.unitPrice || 0);
  const net = gross * (1 - (item.discountRate || 0) / 100);
  const tax = net * (item.taxRate || 0) / 100;
  return { net, tax, total: net + tax };
}

function withComputedTotals(quote) {
  const obj = quote.toObject ? quote.toObject() : (typeof quote.toJSON === 'function' ? quote.toJSON() : quote);
  const items = (obj.items || []).map((it) => {
    const itemObj = it.toObject ? it.toObject() : it;
    return { ...itemObj, ...computeLine(itemObj) };
  });
  const subtotal = items.reduce((s, i) => s + i.net, 0);
  const totalTax = items.reduce((s, i) => s + i.tax, 0);
  return { ...obj, items, subtotal, totalTax, grandTotal: subtotal + totalTax };
}

module.exports = { computeLine, withComputedTotals };
