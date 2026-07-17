// Backend/utils/tenure.js ile aynı formül — sunucudan gelen tenureMonths/
// sinceMonths değerlerini ekranda biçimlendirmek için (DOM'a bağımlı değil,
// mobil taşınabilirlik için plain function — bkz. proje mimari prensibi).

/** Dizin kartındaki hızlı kıdem satırı için — createdAt zaten user listesinde geliyor,
 *  ayrı bir /tree isteği gerektirmeden client'ta hesaplanır. */
export function monthsBetween(startDate, now = Date.now()) {
  const s = new Date(startDate);
  const n = new Date(now);
  let months = (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth());
  if (n.getDate() < s.getDate()) months -= 1;
  return Math.max(months, 0);
}

/** Bir aydan az kıdemi anlamlı göstermek için (yeni katılanlar hep "0 ay" görünmesin diye). */
export function daysBetween(startDate, now = Date.now()) {
  const s = new Date(startDate);
  const n = new Date(now);
  return Math.max(Math.floor((n - s) / 86400000), 0);
}

/** "1 yıl 3 ay" / "1 yıl" / "4 ay" / "3 gün" / "Bugün katıldı" */
export function formatTenureSpan(months, days = 0) {
  if (months <= 0) {
    if (days <= 0) return 'Bugün katıldı';
    return days === 1 ? '1 gün' : `${days} gün`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y > 0 && m > 0) return `${y} yıl ${m} ay`;
  if (y > 0) return `${y} yıl`;
  return `${m} ay`;
}

/** "1 yıl 2 aydır" / "1 yıldır" / "4 aydır" / "3 gündür" / "bugün başladı" */
export function formatTenureSince(months, days = 0) {
  if (months <= 0) {
    if (days <= 0) return 'bugün başladı';
    return days === 1 ? '1 gündür' : `${days} gündür`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y > 0 && m > 0) return `${y} yıl ${m} aydır`;
  if (y > 0) return `${y} yıldır`;
  return `${m} aydır`;
}
