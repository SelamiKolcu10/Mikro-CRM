/**
 * Satır ve teklif toplamlarını hesaplar — backend utils/quoteTotals.js ile
 * birebir aynı formül (senkron tutulacak). DOM'suz saf fonksiyon (RN uyumlu).
 */

export function computeLine(item) {
  const gross = (item.quantity || 0) * (item.unitPrice || 0);
  const net = gross * (1 - (item.discountRate || 0) / 100);
  const tax = net * (item.taxRate || 0) / 100;
  return { net, tax, total: net + tax };
}

export function withComputedTotals(quote) {
  const items = (quote.items || []).map((it) => ({ ...it, ...computeLine(it) }));
  const subtotal = items.reduce((s, i) => s + i.net, 0);
  const totalTax = items.reduce((s, i) => s + i.tax, 0);
  return { ...quote, items, subtotal, totalTax, grandTotal: subtotal + totalTax };
}
