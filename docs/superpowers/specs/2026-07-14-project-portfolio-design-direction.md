# Project Portfolio & Task Comments — Tasarım Yönü Önerisi

Tarih: 2026-07-14 | Durum: Onay bekliyor

## Amaç

Sadece yeni yüzeyler için görsel yön: proje kartları grid'i, dairesel progress ring, tech-stack
pill'leri, ekip avatar yığını, slide-over drawer, markdown wiki görüntüleyici/editörü, görev
yorumları zaman çizelgesi + input. **Bu bir reskin değildir** — mevcut koyu glassmorphism token
sistemi (`--bg-*`, `--accent-primary: #7c5cfc`, `--space-*`, `--radius-*`, `--transition-*`,
Inter) aynen temel alınır; aşağıdaki her şey o sistemin üstüne bu alana özgü bir dil ekler.

## 1) Görsel Fikir: "Kapsül & Halka"

Genel şablon yerine tek, adlandırılmış bir geometri kuralı: **statü bildiren her şey kapsül,
nicel her şey halka.**

- **Kapsül:** tech-stack pill'leri, rol rozetleri, yorum input'u ve drawer'daki statü grup
  başlıkları aynı şekli paylaşır — `--radius-full`, 1px token-renkli border, `-soft` (%12 alfa)
  zemin. Mevcut `.badge-*` / `.role-badge-*` dilinin bilinçli genişletmesi; feature kendi içinde
  ve uygulamanın geri kalanıyla tek parça okunur.
- **Halka (proje sağlığı):** progress ring sadece yüzde değil durum anlatır — stroke rengi
  eşiklerle geçer: `%0` kesikli (dashed) `--border-primary` iz ("henüz nabız yok"),
  `1–99` arası `--accent-primary → --accent-secondary` doğrusal gradient stroke,
  `%100`'de tek renk `--color-success`'e oturur. Renk tek başına taşımaz: yüzde rakamı halkanın
  ortasında her zaman yazılıdır.

Bu iki kural kartta, drawer'da ve yorum alanında tekrar eder → "üretildi" değil "tasarlandı"
hissi buradan gelir. (Kalite çıtası #1: somut, adlandırılmış bakış açısı — karşılandı.)

## 2) Tipografi

Gövde/başlık **Inter kalır** (uygulama tipografisi değişmez). Tek yeni eleman: **JetBrains Mono**
(Google Fonts, 400/500), yalnızca iki yerde — tech-stack pill metni ve ring içindeki yüzde
rakamı. Eşleşme mantığı: JetBrains Mono, Inter ile benzer x-yüksekliği ve nötr grotesk iskelet
taşır; teknik kimlik (paket adları, sayılar) "kod" sesiyle konuşur, hiyerarşiyi bozmaz. Başka
hiçbir yüzeyde kullanılmaz — sızarsa fikir ucuzlar. (Çıta #2: font adı + eşleşme gerekçesi —
karşılandı.)

## 3) Renk

Yeni palet yok; mevcut 5 vurgu (`--accent-primary`, `--color-info/success/warning/danger`) +
`-soft` çiftleri aynen kullanılır. Tech-stack pill rengi, `TaskAvatar`'daki deterministik renk
seçiminin aynı mekanizmasıyla (string hash → bu 5 token çiftinden biri) atanır — "React" her
kartta hep aynı renktir. Ring eşik renkleri de (Bölüm 1) bu setten. (Çıta #3 — karşılandı.)

## 4) Hiyerarşi

- **Kart:** tek görsel çapa halkadır (56px, sağ üst). Sol blok: proje adı (18px/600) → altında
  pill sırası (12px, en fazla 4 + `+n` taşma kapsülü) → en altta avatar yığını. Kart içi
  `--space-lg` padding, grid `--space-lg` gap, `minmax(300px, 1fr)` auto-fill — boşluk ayırır,
  border/gölge yığını değil.
- **Drawer:** tek sütun, wiki metni `max-width: 70ch` (satır uzunluğu kontrolü); başlık bölgesi
  sticky, görev akışı statü kapsülleriyle gruplanmış ikincil katman. Yorumlarda metin birincil,
  meta (isim/rol/zaman) 12px ikincil kontrastta. (Çıta #4 — karşılandı.)

## 5) Boş Durumlar & Avatarlar (stok-ikon hissine karşı)

Boş proje grid'i ortasına ikon değil, **hayalet kart** konur: kesikli halka + kapsül
iskeletlerinden oluşan, gerçek kartın %40 opaklıkta anatomisi + tek satır metin + "Yeni Proje"
butonu. Boş yorum akışı: soluk kesikli bir zaman-çizgisi dikmesi + "İlk yorumu sen yaz" metni.
Avatarlar mevcut `TaskAvatar`'dır (deterministik renkli baş harfler); yığında -8px bindirme,
`--bg-card` renkli 2px halka ile ayrışır, 4'ten fazlası `+n` kapsülü. (Çıta #5 — karşılandı.)

## 6) Hareket

Mevcut token'larla, yeni easing icat edilmez:

- **Drawer:** `transform: translateX(100%→0)` — `var(--transition-base)` (250ms,
  cubic-bezier(0.4,0,0.2,1)); arka plan karartması opacity ile `var(--transition-fast)` (150ms).
  Kapanış aynı eğrinin tersi.
- **Ring dolumu:** `stroke-dashoffset`, `var(--transition-slow)` (400ms), drawer/kart ilk
  görünümünde 0'dan hedefe tek sefer.
- **Yorum ekleme:** yeni öğe 150ms opacity+4px translateY ile girer (`--transition-fast`).
- Tümü `@media (prefers-reduced-motion: reduce)` altında kapatılır (ring anında dolu çizilir).

(Çıta #6 — karşılandı.)

## 7) Mobil

Mevcut 768px kırılımında drawer **daralmış yan panel değil, alttan açılan tam ekran sheet**
olur: `translateY(100%→0)`, üstte tutma çizgisi (grab handle) + sticky başlık/kapat butonu,
içerik kendi içinde kayar, arkadaki sayfa `overflow:hidden`. Grid tek sütuna düşer; kart yatay
düzenini korur (halka sağda kalır, küçülmez — dokunma hedefi ve okunurluk için). Yorum input'u
modal içinde alta sabitlenir (klavye açılınca görünür kalır). (Çıta #7 — karşılandı.)

## 8) Erişilebilirlik

- Drawer/sheet: `role="dialog"` + `aria-modal`, açılınca odak içeri taşınır, **focus trap**,
  `Esc` ile kapanır, kapanınca odak tetikleyen karta döner (mevcut `Modal` davranışıyla aynı).
- Kapsül kontrastı: pill metni token'ın tam renk değeriyle, zemin `-soft` (%12 alfa, koyu zemin
  üstünde) — mevcut `.role-badge-*` deseninin AA'yı sağlayan aynı formülü; yeni renk
  kombinasyonu eklenmediği için kontrast rejimi bozulmaz.
- Ring: `role="img"` + `aria-label="%42 tamamlandı"`; renk eşikleri tek bilgi taşıyıcı değil
  (yüzde her zaman yazılı).
- Tüm etkileşimliler görünür `:focus-visible` halkası (mevcut global desen) taşır; kart
  `<button>`/`<a>` semantiğiyle klavyeden açılır. (Çıta #8 — karşılandı.)

## Kapsam Dışı

Uygulama genel temasının/tipografisinin değişmesi, yeni renk paleti, ikon seti değişimi,
Tailwind/CSS-in-JS eklenmesi, animasyon kütüphanesi (her şey CSS transition/SVG ile).

Durum: Onay bekliyor
