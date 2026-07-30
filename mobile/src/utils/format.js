// Shared formatting helpers used across screens.
const SYMBOL = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };

// minFractionDigits: liste/özet ekranlarında 0 (kısa okunur), fiyat
// tanımlarında 2 (katalog "₺250,00" gösterir).
export function formatMoney(amount, currency = 'TRY', minFractionDigits = 0) {
  const sym = SYMBOL[currency] || '';
  const n = Number(amount || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: 2,
  });
  return `${sym}${n}`;
}

// Özet kartlarında milyonluk tutarlar sığmıyor — kısaltarak yaz (₺32,4 Mn).
// Rapor ekranı gibi büyük toplamların olduğu yerler için; kalem/fiyat
// gösteriminde formatMoney kullanılmalı, orada kuruş önemli.
export function formatCompactMoney(amount, currency = 'TRY') {
  const sym = SYMBOL[currency] || '';
  const n = Number(amount || 0);
  const abs = Math.abs(n);

  const [divisor, suffix] =
    abs >= 1e9 ? [1e9, ' Mr'] : abs >= 1e6 ? [1e6, ' Mn'] : abs >= 1e4 ? [1e3, 'B'] : [1, ''];

  const scaled = (n / divisor).toLocaleString('tr-TR', { maximumFractionDigits: divisor === 1 ? 0 : 1 });
  return `${sym}${scaled}${suffix}`;
}

export function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('tr-TR');
  } catch {
    return '—';
  }
}
