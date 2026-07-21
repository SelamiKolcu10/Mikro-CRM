# P3a — Ürün Katalog + Teklif Motoru + PDF — Tasarım Spec

**Tarih:** 2026-07-22
**Statü:** Tasarım onaylandı, uygulamaya hazır (Sonnet).
**Bağlam:** CRM gelir/satış katmanı yol haritası P3'ün ilk yarısı. Roadmap:
`docs/superpowers/specs/2026-07-21-crm-growth-roadmap.md`. P1 (Deal Pipeline)
ve P2 (Müşteri Timeline) bitti; bu spec P3'ü ikiye böldüğümüz **P3a** kısmıdır.

---

## §0 Amaç ve Kapsam

**P3a ne yapar:** Standart ürün/hizmet kataloğu → teklif motoru (satır kalemleri,
otomatik toplam/KDV, revizyon, taslak/gönderildi durumları) → sunucu-taraf PDF
üretimi (puppeteer HTML→PDF). Prospect ilgisini somut bir teklif belgesine bağlar.

**Kullanıcıyla kararlaştırılan üç çatal (2026-07-22):**
1. **PDF motoru:** Puppeteer HTML→PDF. Zaten kurulu; HTML/CSS şablonu en profesyonel
   çıktıyı ve bedava Türkçe/tablo/marka desteğini verir. Bedeli: `puppeteer` prod
   bağımlılığına taşınır, sunucuda Chromium çalışır (düşük teklif hacminde kabul).
2. **Teklif↔Deal:** Teklif `customer`'a **zorunlu**, `deal`'e **opsiyonel** bağlı.
   Deal'den açılırsa ileride değer/olasılık senkronu mümkün; deal olmadan da hızlı
   teklif kesilir.
3. **Satır kalemi:** Katalog ürünü **veya** serbest satır. Katalogdan gelen satır
   fiyat/KDV'yi otomatik doldurur ama teklife **snapshot**'lanır — katalog fiyatı
   sonradan değişse gönderilmiş teklif donmuş kalır.

**Kapsam DIŞI (P3b'ye bırakıldı):**
- Onay akışı (teklifi müşteri kabul/ret; iç onay), `accepted`/`rejected` geçişleri.
- Fatura köprüsü (kabul edilen teklif → fatura). *Not: backend'de giden fatura modeli
  hiç yok; `invoice-ocr-*` yalnız gelen fatura OCR'ı — P3b sıfırdan kuracak.*
- Bildirimler ("müşteri teklifi açtı", "teklif kabul edildi"), e-posta gönderimi.
- Düzenlenebilir **şirket ayarları ekranı** (antet bilgisi P3a'da statik config).

**Kapsam DIŞI (P3a opsiyonel-stretch, süre kalırsa):**
- Teklif olaylarını P2 müşteri timeline'ına bağlamak (buildTimeline'a 5. kaynak).
  Temiz yol belli (§7'de not), ama P3a'nın zorunlu parçası değil.

---

## §1 Veri Modeli

### 1.1 `backend/config/catalog.js` (yeni)
Tek kaynak sabitler (bkz. `config/deals.js` deseni):
```js
const PRODUCT_UNITS = ['piece', 'hour', 'month', 'project', 'license'];
const DEFAULT_TAX_RATE = 20; // KDV %20
// Para birimi tek kaynak: deals'tan re-export (drift olmasın).
const { DEAL_CURRENCIES } = require('./deals');
module.exports = { PRODUCT_UNITS, DEFAULT_TAX_RATE, CATALOG_CURRENCIES: DEAL_CURRENCIES };
```

### 1.2 `backend/config/quotes.js` (yeni)
```js
// draft/sent P3a'da; accepted/rejected/expired enum'da TANIMLI ama geçişleri
// P3b'de. Baştan tanımlı ki sonradan migration gerekmesin.
const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
const QUOTE_EDITABLE_STATUSES = ['draft']; // sadece taslak doğrudan düzenlenir
module.exports = { QUOTE_STATUSES, QUOTE_EDITABLE_STATUSES };
```

### 1.3 `backend/models/CatalogProduct.js` (yeni)
| Alan | Tip | Not |
|------|-----|-----|
| name | String, required, trim, ≤150 | |
| description | String, default '', ≤1000 | |
| sku | String, default '', trim | Opsiyonel stok kodu; v1'de unique DEĞİL (sürtünme) |
| unitPrice | Number, required, min 0 | |
| currency | enum CATALOG_CURRENCIES, default 'TRY' | |
| taxRate | Number, min 0 max 100, default DEFAULT_TAX_RATE | KDV % |
| unit | enum PRODUCT_UNITS, default 'piece' | |
| category | String, default '', trim | Serbest kategori etiketi |
| active | Boolean, default true | **Soft-arşiv**: DELETE = active:false. Silmek yerine pasifle — liste varsayılan `active:true` filtreler |
| timestamps | | |

Index: `{ active: 1, category: 1 }`, `{ name: 1 }`.
**Silme semantiği:** hard delete YOK; teklifler ürünü snapshot'ladığı için veri
bütünlüğü riski yok ama katalog hijyeni için arşivleme tercih edilir
(bkz. [[no-uncontrolled-deletes]] ruhuna uygun).

### 1.4 `backend/models/Counter.js` (yeni — genel amaçlı atomik sayaç)
Teklif numarası (`TKF-2026-0001`) yarış-koşulsuz üretmek için:
```js
const counterSchema = new mongoose.Schema({
  _id: String,        // örn. 'quote-2026'
  seq: { type: Number, default: 0 },
});
counterSchema.statics.next = async function (key) {
  const doc = await this.findByIdAndUpdate(
    key, { $inc: { seq: 1 } }, { new: true, upsert: true }
  );
  return doc.seq;
};
module.exports = mongoose.model('Counter', counterSchema);
```
*AuditSequenceCounter'ı KULLANMA — o hash-zincirine özel. Bu ayrı, genel primitif.*

### 1.5 `backend/models/Quote.js` (yeni)
| Alan | Tip | Not |
|------|-----|-----|
| quoteNumber | String, unique, required | `TKF-{yıl}-{4hane}`, create'te Counter.next('quote-'+yıl) ile üretilir |
| customer | ref Customer, required | |
| deal | ref Deal, default null | Opsiyonel köken bağı |
| owner | ref User, required | Teklifi kesen temsilci |
| status | enum QUOTE_STATUSES, default 'draft' | |
| currency | enum CATALOG_CURRENCIES, default 'TRY' | Teklif geneli tek para birimi (satırlar karışık DEĞİL — v1) |
| validUntil | Date, default null | Geçerlilik tarihi |
| items | [QuoteItem alt-şema] | En az 1 satır (validator) |
| notes | String, default '', ≤2000 | Teklif notu / şartlar |
| version | Number, default 1 | Revizyon no |
| supersedes | ref Quote, default null | Revizyonsa önceki teklife işaret eder |
| sentAt | Date, default null | status→sent'te set |
| timestamps | | |
| optimisticConcurrency: true | | Eşzamanlı düzenleme çakışması → 409 (Deal/Task deseni) |

**QuoteItem alt-şema (`_id: false` DEĞİL — satır düzenlemesi için id lazım):**
| Alan | Tip | Not |
|------|-----|-----|
| product | ref CatalogProduct, default null | Serbest satırda null |
| name | String, required, ≤150 | Snapshot (katalogdan veya serbest) |
| description | String, default '' | |
| quantity | Number, required, min 0 | |
| unitPrice | Number, required, min 0 | Ekleme anındaki snapshot fiyat |
| taxRate | Number, min 0 max 100, default DEFAULT_TAX_RATE | |
| discountRate | Number, min 0 max 100, default 0 | Satır-bazlı indirim % |

Index: `{ customer: 1, createdAt: -1 }`, `{ deal: 1 }`, `{ status: 1 }`, `quoteNumber` unique.

**Toplamlar SAKLANMAZ, hesaplanır** (bkz. §2.3 `withComputedTotals`). `Project.progress`
türev deseniyle aynı — satır ve teklif toplamı okuma-anında hesaplanır. Böylece
formül tek yerde, drift yok. (İstisna: `quoteNumber`, `version` gibi statik alanlar saklanır.)

---

## §2 Backend API / Controller

### 2.1 Katalog — `routes/catalogRoutes.js` + `controllers/catalogController.js`
| Metot | Yol | Yetki | İş |
|-------|-----|-------|-----|
| GET | /api/catalog | catalog.read | Liste (query: `active`, `category`, `q` arama). Varsayılan active:true. Arama regex escape'li (mevcut leadController deseni) |
| POST | /api/catalog | catalog.write | Oluştur |
| GET | /api/catalog/:id | catalog.read | Tek ürün |
| PATCH | /api/catalog/:id | catalog.write | Güncelle |
| DELETE | /api/catalog/:id | catalog.write | **Arşivle** (active:false), hard delete değil |

### 2.2 Teklif — `routes/quoteRoutes.js` + `controllers/quoteController.js`
| Metot | Yol | Yetki | İş |
|-------|-----|-------|-----|
| GET | /api/quotes | quotes.read | Liste (query: `customer`, `deal`, `status`, cursor `before`, `limit`). Toplamlar hesaplanmış döner |
| POST | /api/quotes | quotes.write | Oluştur. `quoteNumber` üret; her item için katalog ürünü verildiyse fiyat/KDV/isim snapshot'la, verilmediyse gövdeden al. owner = req.user |
| GET | /api/quotes/:id | quotes.read | Detay — customer/owner/deal + items.product populate, `withComputedTotals` |
| PATCH | /api/quotes/:id | quotes.write | Güncelle. **Sadece status='draft'** (QUOTE_EDITABLE_STATUSES). Sent teklif düzenlenmez → 409/422 "revize et" |
| POST | /api/quotes/:id/send | quotes.write | draft→sent, sentAt=now. Sadece draft'tan |
| POST | /api/quotes/:id/revise | quotes.write | version+1 klon; yeni teklif status='draft', supersedes=orijinal, yeni quoteNumber. Orijinal olduğu gibi kalır |
| GET | /api/quotes/:id/pdf | quotes.read | PDF üret ve stream et (application/pdf) — §2.4 |
| DELETE | /api/quotes/:id | quotes.write | Sadece draft silinebilir (gönderilmiş teklif iz olarak kalır) |

**Not — `authorizeOrQueue` KULLANMA:** P2'deki gibi, teklif/katalog yazma yolları
düz `authorize(...WRITE_ROLES)` kullanır. Override-onay dispatch'i payload'ı yanlış
yorumlar (bkz. P2 spec'teki activities notu). Genişletilmiş override kapsamı ayrı iş.

### 2.3 `backend/utils/quoteTotals.js` (yeni — saf, DOM'suz, mobil-taşınabilir)
```js
// Satır ve teklif toplamlarını hesaplar. Frontend utils/quoteTotals.js ile
// AYNI formül (senkron tutulacak — ideal olarak tek mantık).
function computeLine(item) {
  const gross = (item.quantity || 0) * (item.unitPrice || 0);
  const net = gross * (1 - (item.discountRate || 0) / 100);
  const tax = net * (item.taxRate || 0) / 100;
  return { net, tax, total: net + tax };
}
function withComputedTotals(quote) {
  const items = (quote.items || []).map((it) => ({ ...it, ...computeLine(it) }));
  const subtotal = items.reduce((s, i) => s + i.net, 0);
  const totalTax = items.reduce((s, i) => s + i.tax, 0);
  return { ...quote, items, subtotal, totalTax, grandTotal: subtotal + totalTax };
}
```
*v1 kısıtı: indirim yalnız satır-bazlı; teklif-geneli indirim ileride.*

### 2.4 PDF — `utils/quotePdf.js` + `utils/pdfRenderer.js` + `config/companyProfile.js`
- **`config/companyProfile.js`** (yeni, statik): `{ name, address, taxNo, phone, email, logoDataUri }`.
  Antet bilgisi. Düzenlenebilir şirket-ayarları ekranı ileride (P3b/sonra).
- **`utils/quotePdf.js`** — `buildQuoteHtml(quote, company, lang)` → HTML **string**.
  DOM yok, saf string şablon (test edilebilir, mobil-taşınabilir). Antet + müşteri
  bloğu + kalem tablosu + ara toplam/KDV/genel toplam + notlar + geçerlilik. Türkçe
  karakter için `<meta charset>` + web-safe font yeter (Chromium render eder).
- **`utils/pdfRenderer.js`** — puppeteer **singleton browser** (lazy launch, tüm
  isteklerde tek instance yeniden kullanılır; istek başına yeni `page`). İstek başına
  Chromium başlatmak PAHALI — bu yüzden singleton şart. `renderHtmlToPdf(html)` →
  Buffer. `page.setContent(html, { waitUntil: 'networkidle0' })` + `page.pdf({ format: 'A4', printBackground: true })`.
- **`package.json`**: `puppeteer` devDependencies'ten **dependencies**'e taşınır
  (prod'da PDF render eder). Chromium indirme prod kurulumunda gelir.

---

## §3 Frontend Mimarisi

### 3.1 Servisler / hook'lar / saf util (mobil-taşınabilir katman)
- `services/catalogService.js`, `services/quoteService.js` — sadece API çağrıları.
- `hooks/useCatalog.js`, `hooks/useQuotes.js`, `hooks/useQuote(id).js`.
- `utils/quoteTotals.js` — backend §2.3 ile birebir aynı formül (DOM'suz saf fonksiyon).
- `config/catalog.js`, `config/quotes.js` — backend config aynası.

### 3.2 Sayfalar / bileşenler
- **`pages/Catalog.jsx`** (Ürün Kataloğu) — tablo + `components/catalog/CatalogForm.jsx`
  modal (oluştur/düzenle). Arşivle butonu. Mevcut liste/modal desenlerini aynala.
- **`pages/Quotes.jsx`** (Teklifler) — teklif listesi (numara, müşteri, tutar, durum
  rozeti, tarih). Satır tıkla → detay drawer (portal'lı, bkz. [[fixed-overlays-need-portal]]).
- **`components/quotes/QuoteBuilder.jsx`** — teklif oluştur/düzenle: müşteri seçici,
  opsiyonel deal seçici, `QuoteLineItems` editörü, canlı toplam (`withComputedTotals`),
  Taslak Kaydet / Gönder / PDF İndir.
- **`components/quotes/QuoteLineItems.jsx`** — satır ekle: katalogdan seç (fiyat/KDV
  otomatik dolar) veya serbest satır. Miktar/fiyat/indirim/KDV düzenlenebilir.
- **`components/quotes/QuoteDetailDrawer.jsx`** — salt-görünüm + Gönder/Revize/PDF aksiyonları.

PDF İndir: `GET /api/quotes/:id/pdf` blob olarak çekilip indirilir (mevcut dosya
indirme deseni varsa aynala).

### 3.3 Navigasyon + rota
- `config/navigation.js` — "Ürün Kataloğu" ve "Teklifler" girişleri (deals/customers
  yakınına). `permissions.js` gate'ine göre görünür.
- `App.jsx` — `/catalog`, `/quotes` rotaları.

---

## §4 RBAC

İki yeni kaynak `PERMISSIONS`'a (backend + frontend aynası):
```js
catalog: { read: [SUPER_ADMIN, STAFF, ACCOUNTANT], write: [SUPER_ADMIN, STAFF] },
quotes:  { read: [SUPER_ADMIN, STAFF, ACCOUNTANT], write: [SUPER_ADMIN, STAFF] },
```
- **Deal'lerle aynı çizgi:** intern **tamamen hariç** (teklif tutarları hassas ciro
  verisi — leads'teki maskeleme değil, route intern'i hiç sokmaz). accountant okur
  (forecast/fiyatlandırma), yazamaz. support hariç (satış değil destek).
- `OVERRIDABLE_RESOURCES`'a **eklenmez** (override akışı yazma payload'ını yanlış
  yorumlar — §2.2 notu).

---

## §5 v1 Sınırları (bilerek yapılmayanlar)
- Onay/kabul-ret akışı, fatura köprüsü, bildirim, e-posta → **P3b**.
- Teklif-geneli indirim, karışık para birimli satır, kur dönüşümü → sonra.
- Düzenlenebilir şirket-ayarları ekranı → sonra (antet statik config).
- Sunucu-taraf gerçek sayfalama (teklif listesi) → P4; şimdilik cursor `before` + cap.
- Teklif→timeline entegrasyonu → opsiyonel stretch (§7), yoksa P3b.

---

## §6 Doğrulama (uygulama sonrası)
- API: katalog CRUD + arşiv; teklif oluştur (katalog satırı + serbest satır),
  toplam/KDV doğru mu; draft→send; revise version+1; PATCH sent teklifte reddediliyor mu.
- RBAC: intern `/api/quotes` ve `/api/catalog`'da 403; accountant read OK / write 403.
- PDF: `GET /:id/pdf` `%PDF` magic byte'ıyla başlıyor mu, boyut > 0.
- Puppeteer görsel script (`scripts/verify-customer-timeline.js` desenini kopyala):
  katalog ürünü oluştur → teklif kur → toplam görün → PDF indir. (bkz.
  [[fixed-overlays-need-portal]] tuzakları: ayrı context, `waitForFunction`.)

---

## §7 Sonnet için dosya listesi
**Backend yeni:** `config/catalog.js`, `config/quotes.js`, `config/companyProfile.js`,
`models/CatalogProduct.js`, `models/Quote.js`, `models/Counter.js`,
`utils/quoteTotals.js`, `utils/quotePdf.js`, `utils/pdfRenderer.js`,
`controllers/catalogController.js`, `controllers/quoteController.js`,
`validators/catalogValidators.js`, `validators/quoteValidators.js`,
`routes/catalogRoutes.js`, `routes/quoteRoutes.js`.
**Backend değişen:** `config/permissions.js` (+catalog +quotes), `server.js` (route mount),
`package.json` (puppeteer → dependencies).
**Frontend yeni:** `config/catalog.js`, `config/quotes.js`, `services/catalogService.js`,
`services/quoteService.js`, `hooks/useCatalog.js`, `hooks/useQuotes.js`, `hooks/useQuote.js`,
`utils/quoteTotals.js`, `pages/Catalog.jsx`, `pages/Quotes.jsx`,
`components/catalog/CatalogForm.jsx`, `components/quotes/QuoteBuilder.jsx`,
`components/quotes/QuoteLineItems.jsx`, `components/quotes/QuoteDetailDrawer.jsx`.
**Frontend değişen:** `config/permissions.js`, `config/navigation.js`, `App.jsx`,
`i18n/en.json`, `i18n/tr.json`, `index.css`.

**Uygulama sırası (aşamalı, her aşama tek başına test edilebilir):**
1. Katalog backend + frontend (küçük, izole).
2. Teklif backend (model + controller + toplam util + validator).
3. Teklif frontend (builder + liste + drawer).
4. PDF (renderer singleton + HTML şablon + indirme).

**Opsiyonel stretch (§0):** Teklif oluştur/gönder olayını P2 timeline'ına bağlamak —
`buildTimeline`'a 5. kaynak (Quote) ekle; `utils/customerTimeline.js`'e `mapQuotes`
+ frontend `EVENT_META`'ya `quote:*` satırları. Zorunlu değil.
