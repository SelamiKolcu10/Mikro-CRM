/**
 * CSAT ortalaması — panelde "4.2/5 · son N değerlendirme" olarak gösterilir.
 * Tüm geçmiş yerine SON `sampleSize` puanın ortalaması alınır: eski bir
 * müşteri ilişkisinin en güncel algısını yansıtır, yıllar önceki tek bir
 * kötü puan sonsuza dek ortalamayı çekmesin diye (bkz. leadScoring.js ile
 * aynı "tek yerde hesapla" deseni).
 */
function computeSatisfaction(ratings, sampleSize = 6) {
  if (!ratings || ratings.length === 0) return { avg: null, count: 0 };
  const recent = [...ratings]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, sampleSize);
  const sum = recent.reduce((acc, r) => acc + r.score, 0);
  return { avg: Math.round((sum / recent.length) * 10) / 10, count: recent.length };
}

module.exports = { computeSatisfaction };
