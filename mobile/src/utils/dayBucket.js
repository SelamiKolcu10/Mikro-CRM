/**
 * Tek TZ kuralı: "gün" her yerde CİHAZIN YEREL saatine göre hesaplanır
 * (toISOString() ile DEĞİL — o UTC'ye çevirir ve gece yarısına yakın
 * deadline'ları yanlış güne kaydırır). Web'deki utils/dayBucket.js'in birebir
 * kopyası; ikisi senkron tutulmalı.
 */

/** Bir Date'i yerel takvim alanlarından 'YYYY-MM-DD' string'ine çevirir. */
export function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Bir task.deadline (Date | ISO string | null) için gün anahtarı; yoksa null. */
export function dayBucketOf(deadline) {
  if (!deadline) return null;
  return toLocalISODate(new Date(deadline));
}

/**
 * Bir görevi yeni bir güne taşırken kullanılır: eski deadline'ın saat/dakikasını
 * korur, yalnız yıl/ay/gün'ü hedef güne çeker. Eski deadline yoksa öğlen
 * (12:00) yerel saate sabitlenir — gece yarısına yakın bir saat UTC'ye
 * çevrilince günün kaymasına yol açabilir.
 */
export function withNewDay(previousDeadline, targetDayISO) {
  const [y, m, d] = targetDayISO.split('-').map(Number);
  const base = previousDeadline ? new Date(previousDeadline) : null;
  const hours = base ? base.getHours() : 12;
  const minutes = base ? base.getMinutes() : 0;
  const seconds = base ? base.getSeconds() : 0;
  return new Date(y, m - 1, d, hours, minutes, seconds);
}
