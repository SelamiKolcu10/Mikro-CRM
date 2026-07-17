/** Tam ay sayısı — gün farkına bakmadan takvim ayı bazlı (mockup'taki JS ile aynı formül). */
function monthsBetween(startDate, now = Date.now()) {
  const s = new Date(startDate);
  const n = new Date(now);
  let months = (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth());
  if (n.getDate() < s.getDate()) months -= 1;
  return Math.max(months, 0);
}

/** Bir aydan yeni kıdemler için — frontend tenureMonths=0 olduğunda bunu
 *  gün cinsinden göstererek "herkes 0 görünüyor" sorununu önler. */
function daysBetween(startDate, now = Date.now()) {
  const s = new Date(startDate);
  const n = new Date(now);
  return Math.max(Math.floor((n - s) / 86400000), 0);
}

module.exports = { monthsBetween, daysBetween };
