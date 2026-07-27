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

export function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('tr-TR');
  } catch {
    return '—';
  }
}
