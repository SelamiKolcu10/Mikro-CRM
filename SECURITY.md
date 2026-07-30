# Güvenlik Politikası

## Açık bildirimi

Bir güvenlik açığı bulduysanız **herkese açık issue açmayın**. Bunun yerine
GitHub'ın özel bildirim akışını kullanın:

> Repo → **Security** sekmesi → **Report a vulnerability**

Bu kanal yalnızca depo sahibine görünür. (Depo sahibi için not: bu akışın
çalışması için Settings → Code security → *Private vulnerability reporting*
açık olmalıdır.)

## Kapsam

| Bileşen | Dizin | Not |
|---|---|---|
| API + kimlik doğrulama | `backend/` | Asıl saldırı yüzeyi |
| Gider faturası OCR (v2) | `invoice-ocr-v2/` | Kullanıcı yüklediği görselleri işler |
| Gider faturası OCR (v1) | `invoice-ocr-service/` | Eski sürüm |
| Web arayüzü | `frontend/` | Vite SPA |
| Mobil uygulama | `mobile/` | Expo / React Native |

## Bu depo public

Kaynak kodun herkese açık olması bilinçli bir tercihtir. Sonucu şudur:
**güvenlik hiçbir noktada kaynağın gizliliğine dayanmaz.** Uçların listesi, izin
matrisi ve iş mantığı okunabilir; yetkilendirme her uçta sunucu tarafında
uygulanır.

Buradan çıkan katı kural: **hiçbir gizli değer koda girmez.** Tüm secret'lar
(`JWT_SECRET`, `MONGO_URI`, SMTP ve e-Fatura kimlik bilgileri) ortam
değişkenlerinden okunur. `.env` dosyaları `.gitignore` kapsamındadır ve depo
geçmişinde hiç yer almamıştır.

`README.md` içindeki demo giriş bilgileri **yalnızca yerel `npm run seed`
verisi içindir**; herhangi bir canlı ortamda geçerli değildir.

## Bilinçli olarak kabul edilen bulgular

`npm audit` aşağıdaki iki bulguyu raporlar. İkisi de incelenmiş ve bu projede
sömürülebilir olmadığı için **kasıtlı olarak düzeltilmemiştir** — "düzeltmeleri"
fayda sağlamadan sürüm düşürmek anlamına gelirdi.

### 1. `react-router` / `react-router-dom` — GHSA-qwww-vcr4-c8h2 (high)

*RSC Mode CSRF Bypass Allows Action Execution Before 400 Response*

- Açık yalnızca **RSC (React Server Components) modunu** etkiler.
- Bu uygulama `BrowserRouter` ile saf istemci-taraflı SPA olarak çalışır;
  RSC modu, framework modu, `@react-router/dev` veya sunucu tarafı action
  kullanılmaz. Etkilenen kod yolu projede hiç yürütülmez.
- 7.x hattında **yamalı sürüm yoktur**: açık `7.12.0 – 8.2.0` aralığını
  kapsar, en güncel sürüm `7.18.2`'dir. `npm audit fix`'in önerdiği tek yol
  `7.11.0`'a düşmektir — yedi minor sürüm geri gitmek, sıfır güvenlik kazancı
  karşılığında.

**Yeniden değerlendirme koşulu:** yamalı bir sürüm yayımlanırsa ya da proje
RSC/framework moduna geçerse.

### 2. `uuid < 11.1.1` — GHSA-w5hq-g745-h8pq (moderate, 11 kayıt)

*Missing buffer bounds check in v3/v5/v6 when `buf` is provided*

- Zincir: `uuid` → `xcode` → `@expo/config-plugins` → Expo CLI/build araçları
  (`@expo/cli`, `@expo/metro-config`, `@expo/prebuild-config`, …).
- `xcode` bir **build-zamanı** paketidir (iOS proje dosyası düzenler) ve
  yayımlanan uygulama paketine girmez. Uygulama kodu `uuid`'yi hiç çağırmaz,
  dolayısıyla açığın gerektirdiği `buf` argümanlı çağrı hiç oluşmaz.
- `npm audit fix --force` bu depoda `expo-sharing`'i `57.0.8` → `14.0.8`'e
  **düşürür** (npm, Expo'nun SDK-hizalı sürümlemesini yanlış yorumluyor) ve
  uygulamayı kırar. Bağımlılıklar bunun yerine `npx expo install --fix` ile
  SDK 57'ye hizalanmıştır.

**Yeniden değerlendirme koşulu:** Expo SDK `xcode`/`uuid` sürümünü yükseltirse.

## Oturum ve token yönetimi

Erişim token'ı (JWT) 7 gün geçerlidir. JWT durumsuz olduğu için token'ın
kendisi geri alınamaz; bunun yerine her hesapta bir `tokenVersion` sayacı
tutulur ve token'a gömülür. Her istek bu değeri canlı kayıtla karşılaştırır
(`protect`, `protectPortal`, socket handshake ve iki fatura servisi).

Sayacı artıran — yani o hesabın **önceden üretilmiş bütün token'larını anında
öldüren** olaylar:

- Parola değişikliği
- Rol veya durum değişikliği
- **Çıkış yapma** (`POST /api/auth/logout`)

### Bilinen sınır: iptal cihaz bazında değil, hesap bazında

Bir cihazda çıkış yapmak o hesabın diğer oturumlarını da düşürür. Bu bilinçli
bir ödündür: cihaz başına iptal, ayrı bir yenileme (refresh) token modeli ve
oturum kaydı gerektirir. Mevcut modelde çalınmış bir token'ın ömrü, kullanıcı
çıkış yapana veya parolasını değiştirene kadar (en fazla 7 gün) sürer.

**Yeniden değerlendirme koşulu:** çok cihazlı kullanım yaygınlaşırsa ya da
düzenleyici bir gereklilik daha kısa oturum ömrü zorunlu kılarsa, 15 dakikalık
erişim + rotasyonlu yenileme token'ı modeline geçilmelidir.

## Üretim yapılandırması

`NODE_ENV=production` iken uygulanan kurallar:

| Kural | Davranış |
|---|---|
| `FRONTEND_URL` https olmalı | Değilse **sunucu açılmaz** (CORS origin'i budur) |
| `TRUST_PROXY` tanımlıysa | http istekleri 308 ile https'e yönlendirilir |
| `TRUST_PROXY` tanımsızsa | Uyarı loglanır — vekil arkasında rate limiting gerçek IP'yi göremez |
| Beklenmeyen (500) hatalar | Ham hata mesajı istemciye dönmez, sunucuda loglanır |

HSTS, `nosniff`, `frameAncestors: none` ve CSP helmet tarafından uygulanır.
`/uploads` yolu bilinçli olarak `Cross-Origin-Resource-Policy: cross-origin`
taşır (avatarlar farklı origin'deki web arayüzünden yüklenir); API yanıtları
`same-origin` korumasını sürdürür.

## Otomatik kontroller

`.github/workflows/security.yml` her push/PR'da ve haftalık olarak çalışır.

| Kontrol | Araç | Bloklar mı? |
|---|---|---|
| Depoya secret sızmış mı (geçmiş dahil) | gitleaks | **Evet** |
| Bağımlılık açıkları | `scripts/audit-check.js` | **Evet** |
| Statik analiz | Semgrep | Hayır — bkz. workflow'daki not |
| İkinci açık veritabanı | osv-scanner | Hayır (bilgilendirme) |

Semgrep şimdilik bloklamıyor: kural setlerinin bu depoda ne bulacağı henüz
triyaj edilmedi ve triyaj edilmemiş bir kapı yalnızca "kırmızıyı yoksay"
alışkanlığı üretir. Bulgular Security → Code scanning sekmesine düşer; gözden
geçirildikten sonra workflow'daki `continue-on-error` satırı kaldırılmalıdır.

### Yerelde çalıştırma

```bash
npm run audit:check
```

Bu betik beş çalışma alanının tamamını tarar ve yukarıdaki allowlist'i uygular.
Allowlist dışı bir bulgu varsa sıfırdan farklı kodla çıkar.

Yalnızca ham çıktıyı görmek için:

```bash
cd backend && npm audit --omit=dev   # üç backend de sıfır açık göstermelidir
```
