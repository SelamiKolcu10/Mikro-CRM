/**
 * Referans (lookup) verisi için küçük istemci önbelleği.
 *
 * NEDEN VAR: mobil ekranlar `useFocusEffect` ile HER odaklanmada veri çekiyor
 * (Projeler, Kullanıcılar) — sekme değiştirip geri dönmek her seferinde bir
 * istek demekti. Görev Oluştur modalı da her açılışta departman üyelerini
 * yeniden istiyordu. Web'deki `utils/lookupCache.js` ile aynı sözleşme;
 * paylaşılan paket olmadığı için kopyalanmış, davranış birebir aynı.
 *
 * NEDEN GÜVENLİ: bu uygulamada bayat veri hatalı kayıt üretemiyor, çünkü
 * sunucu her YAZMADA yeniden doğruluyor (ör. taskController atanan kişinin
 * departmanını tekrar kontrol edip uymuyorsa 400 dönüyor). Bayat bir liste en
 * kötü hâlde "seçtim, sunucu reddetti" ile sonuçlanır; veri bozulmaz.
 *
 * NEREDE KULLANILMAZ: durumu anlık önemli olan hiçbir yerde — onay kuyruğu,
 * canlı sohbet, denetim kaydı, görev panosu durumları, fırsat aşamaları,
 * fatura durumları. Bunlar bilerek dışarıda bırakıldı.
 *
 * YETKİ NOTU: önbellekten okunan şey yalnızca bir LİSTE'dir; yetki kararı
 * asla buradan verilmez. Kim ne yapabilir sorusunun cevabı her zaman sunucuda
 * (requireProjectManager, canViewProject, authorizeOrQueue).
 */

// key -> { at, value }
const store = new Map();
// key -> Promise  (uçuşta olan istekler)
const inflight = new Map();

/** Kaynak bazlı tazelik süreleri (ms). Değişme sıklığına göre. */
export const TTL = {
  catalog: 10 * 60 * 1000, // ürünler nadiren değişir
  projects: 5 * 60 * 1000,
  users: 3 * 60 * 1000,
  assignableUsers: 5 * 60 * 1000,
  eligibleMembers: 5 * 60 * 1000,
};

/**
 * Önbellekli çağrı.
 *
 * İki ayrı kazanç sağlıyor:
 *  1. TTL — süre dolmadıysa ağa hiç çıkılmaz.
 *  2. Eşzamanlı istek birleştirme (in-flight dedup) — aynı anahtar için
 *     halihazırda bir istek uçuyorsa ikincisi YENİ istek açmaz, aynı sözü
 *     bekler. Üç bileşenin aynı anda mount olduğu durumu tek isteğe indiren
 *     şey budur; TTL tek başına bunu çözmez çünkü ilk yanıt henüz dönmemiştir.
 */
export function cachedRequest(key, fetcher, ttlMs) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return Promise.resolve(hit.value);
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = fetcher()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Anahtar ön-ekiyle geçersiz kılma. Yazma işlemlerinden SONRA çağrılır —
 * olmazsa "yeni eklediğim kayıt listede yok" şikâyeti gelir.
 * Uçuştaki istekler de düşürülür: eski veriyi getirmek üzere olan bir istek
 * yazma sonrası artık yanlıştır.
 */
export function invalidate(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

/**
 * Tüm önbelleği boşalt. Oturum kapanışında ZORUNLU: farklı kullanıcı farklı
 * yetki demek, önceki kullanıcının gördüğü listeler yenisine sızmamalı.
 */
export function clearLookupCache() {
  store.clear();
  inflight.clear();
}

/** Anahtar üretici — parametreler anahtara girmeli, yoksa farklı filtreler birbirini ezer. */
export const cacheKey = (resource, params) =>
  params && Object.keys(params).length ? `${resource}:${JSON.stringify(params)}` : resource;
