# P3b — Teklif Onay Akışı + Fatura Köprüsü + Bildirim — Tasarım Spec

**Tarih:** 2026-07-22
**Statü:** Tasarım onaylandı, uygulamaya hazır (Sonnet). **P3a'nın ÜZERİNE kurulur —
P3a (katalog + teklif + PDF) bitmeden başlanmaz.**
**Bağlam:** Roadmap `docs/superpowers/specs/2026-07-21-crm-growth-roadmap.md`, P3'ün
ikinci yarısı. P3a spec: `docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md`.

---

## §0 Amaç ve Kapsam

**P3b ne yapar:** Gönderilen teklifi müşterinin **girişsiz public link** ile görüp
**kabul/ret** etmesi → kabul edilen teklifin **hafif giden faturaya** dönüşmesi →
personele **in-app bildirim** (müşteri açtı / kabul etti / reddetti). "Teklif→Onay→
Fatura" zincirini kapatır.

**Kullanıcıyla kararlaştırılan üç çatal (2026-07-22):**
1. **Onay = MÜŞTERİ onayı.** Gönderilen teklifi müşteri kabul/ret eder; kabul → fatura.
   (İç yönetici onayı DEĞİL.)
2. **Kabul kanalı = public tokenlı link.** Girişsiz benzersiz link (Görüntüle/Kabul/Ret).
   E-posta ertelendiği için link elle paylaşılır. "Müşteri açtı" takibi link açılış
   zamanıyla. Portal erişimi şart değil — her müşteride çalışır.
3. **Fatura = hafif iç kayıt.** Kabul edilen teklifin snapshot'ı + fatura no + durum
   (ödenmedi/kısmi/ödendi/iptal) + vade + ödeme kaydı. Teklif kalemlerini devralır,
   P3a PDF motorunu yeniden kullanır.

**Kapsam DIŞI (P3b'de yapılmayanlar):**
- E-posta ile teklif/fatura gönderimi (link/PDF elle paylaşılır) — roadmap'te ertelendi.
- **Kalıcı kişi-bazlı bildirim kutusu (bell/inbox).** v1'de ephemeral socket banner
  (SLA eskalasyon deseni) + kalıcı `QuoteEvent` yeter; inbox ayrı iş.
- e-Fatura/GİB, banka mutabakatı, kur dönüşümü.
- Otomatik `Deal→won` (kabul edilince) — opsiyonel not (§7), varsayılan kapalı.
- Kısmi ödeme taksit planı, iade/düzeltme faturası, para iadesi.

---

## §1 Veri Modeli

### 1.1 `models/Quote.js`'e eklenen alanlar (P3a Quote'u genişletilir)
| Alan | Tip | Not |
|------|-----|-----|
| publicToken | String, default null, sparse **unique** index | Gönderimde üretilir: `crypto.randomBytes(24).toString('hex')` (48 hane, tahmin edilemez) |
| publicViewedAt | Date, default null | Public link İLK açılışında set → "müşteri açtı" |
| respondedAt | Date, default null | Kabul/ret anı |
| rejectionReason | String, default '', ≤500 | Müşteri ret gerekçesi (opsiyonel) |

P3a'da enum'a tanımlanan `accepted`/`rejected`/`expired` geçişleri BURADA uygulanır.
`sent`→`accepted`/`rejected` yalnız public uçtan; `expired` `validUntil` geçince
(okuma-anında türetilebilir veya cron; v1: okuma-anında `validUntil < now && status==='sent'`
→ efektif expired, kabul reddedilir).

### 1.2 `models/QuoteEvent.js` (yeni — teklif yaşam döngüsü + bildirim kaynağı)
`DealEvent`/`LeadEvent` ile birebir desen (denormalize `actorName` snapshot):
```js
const ACTIONS = ['created', 'sent', 'viewed', 'accepted', 'rejected', 'revised', 'invoiced'];
// quote (ref, required), actor (ref User, null — müşteri/sistem eylemi),
// actorName (required; müşteri eyleminde 'Müşteri'), action (enum), note (default null).
// timestamps { createdAt: true, updatedAt: false }; index { quote: 1, createdAt: -1 }.
```
**Not:** P3b, P3a'nın create/send/revise controller'larına da QuoteEvent yazımı ekler
(created/sent/revised). viewed/accepted/rejected/invoiced P3b'de eklenir. Bu koleksiyon
hem kalıcı yaşam-döngüsü izi hem P2 timeline kaynağıdır (§4).

### 1.3 `config/salesInvoices.js` (yeni)
```js
const SALES_INVOICE_STATUSES = ['unpaid', 'partial', 'paid', 'void'];
const PAYMENT_METHODS = ['transfer', 'card', 'cash', 'other'];
module.exports = { SALES_INVOICE_STATUSES, PAYMENT_METHODS };
```

### 1.4 `models/Invoice.js` (yeni — GİDEN satış faturası)
> **Dikkat — GELEN vs GİDEN fatura (kullanıcıyla netleştirildi 2026-07-22):** Mevcut
> "Faturalar / Fatura v2" (`invoice-ocr-*` servisleri, `invoices` izni) GELEN gider
> faturalarının OCR muhasebesidir — o modüle HİÇ dokunulmaz. Buradaki `Invoice` ise
> GİDEN satış faturası (müşteriye kesilen, gelir). Veri olarak tamamen ayrı (ortak alan
> yok). Ayrı RBAC (`salesInvoices`), ayrı route (`/api/sales-invoices`), ve **arayüzde
> AYRI PANEL** — "Satış Faturaları" adıyla ayrı menü (mevcut "Faturalar" menüsüne
> sekme olarak eklenmez). Karışma riski sıfırlanır.

| Alan | Tip | Not |
|------|-----|-----|
| invoiceNumber | String, unique, required | `FTR-{yıl}-{4hane}`, `Counter.next('invoice-'+yıl)` (P3a Counter) |
| quote | ref Quote, default null | Kaynak teklif |
| customer | ref Customer, required | |
| deal | ref Deal, default null | Tekliften devralınır |
| owner | ref User, required | Faturayı kesen |
| currency | enum CATALOG_CURRENCIES | Tekliften devralınır |
| items | [QuoteItem şekli] | Teklif kalemlerinin **snapshot**'ı (kopya) |
| notes | String, default '' | |
| issueDate | Date, default now | |
| dueDate | Date, default null | Vade |
| status | enum SALES_INVOICE_STATUSES, default 'unpaid' | |
| payments | [{ amount: Number≥0, paidAt: Date, method: enum PAYMENT_METHODS, note: String }] | Ödeme kayıtları |
| timestamps | | |

**Toplamlar** P3a `withComputedTotals` ile hesaplanır (aynı item şekli).
**status türevi:** `paidAmount = Σ payments.amount`. `void` elle set edilmediyse:
`paidAmount>=grandTotal → paid`, `paidAmount>0 → partial`, else `unpaid`. Ödeme
eklendikçe controller status'ü yeniden hesaplar. `void` terminal (immutable).

---

## §2 Backend API

### 2.1 Public (GİRİŞSİZ, token-gated, rate-limited) — `routes/publicQuoteRoutes.js`
`server.js`'te auth'suz mount edilir; yeni `publicQuoteRateLimiter`
(bkz. `middleware/security.js` leadRateLimiter deseni) uygulanır.
| Metot | Yol | İş |
|-------|-----|-----|
| GET | /api/public/quotes/:token | Teklifi müşteri-görünümü shape'iyle döner (firma anteti, müşteri adı, kalemler, toplam, geçerlilik). İLK açılışta `publicViewedAt` set + `QuoteEvent('viewed')` + staff socket bildirimi. Sadece `sent/accepted/rejected` görüntülenebilir; `draft` → 404 |
| POST | /api/public/quotes/:token/accept | `sent`→`accepted`, `respondedAt`, `QuoteEvent('accepted')`, staff bildirimi. Guard: status='sent' + `validUntil` geçmemiş; değilse 409/410 |
| POST | /api/public/quotes/:token/reject | `sent`→`rejected`, `rejectionReason`, `respondedAt`, `QuoteEvent('rejected')`, staff bildirimi |

**Public shape sınırı:** owner iç notu, maliyet, iç alanlar sızmaz — açıkça
whitelist'lenmiş alanlar döner (teklif zaten müşteriye gidecek içerik ama shape yine
de sınırlı). Token gövdede/response'ta echo edilmez.

### 2.2 İç uçlar — `routes/quoteRoutes.js`'e eklenenler
| Metot | Yol | Yetki | İş |
|-------|-----|-------|-----|
| POST | /api/quotes/:id/send | quotes.write | (P3a'daki send) **+ publicToken üret** + `QuoteEvent('sent')`. Link'i response'ta döner (personel kopyalar) |
| POST | /api/quotes/:id/invoice | quotes.write | Kabul edilmiş tekliften fatura üret. Guard: `status='accepted'`. Kalemleri snapshot'la, `invoiceNumber` üret, `QuoteEvent('invoiced')`. Döner: yeni Invoice |

### 2.3 Satış faturası — `routes/salesInvoiceRoutes.js` + controller
| Metot | Yol | Yetki | İş |
|-------|-----|-------|-----|
| GET | /api/sales-invoices | salesInvoices.read | Liste (query: customer, status) |
| GET | /api/sales-invoices/:id | salesInvoices.read | Detay + hesaplanmış toplam |
| POST | /api/sales-invoices/:id/payments | salesInvoices.write | Ödeme ekle → status yeniden hesapla |
| PATCH | /api/sales-invoices/:id | salesInvoices.write | Sınırlı: dueDate/notes/void. `void` terminal |
| GET | /api/sales-invoices/:id/pdf | salesInvoices.read | P3a `pdfRenderer` + fatura HTML şablonu (`utils/invoicePdf.js`) |

**`authorizeOrQueue` KULLANILMAZ** (P2/P3a notu — override dispatch payload'ı yanlış yorumlar).

---

## §3 Bildirim (in-app)

**Desen:** SLA eskalasyonuyla aynı — `getIO().to(STAFF_ROOM).emit(event, payload)`
(bkz. `services/slaEscalationService.js`). Küçük yardımcı: `utils/quoteNotify.js`
(`getIO` yoksa/başlamadıysa sessiz yut — bildirim ikincil, ana yazımı bloklamaz;
"gevşek tutarlılık" deseni).

| Olay | Socket event | Kime |
|------|--------------|------|
| Müşteri teklifi açtı | `quote:viewed` | STAFF_ROOM (banner) |
| Müşteri kabul etti | `quote:accepted` | STAFF_ROOM |
| Müşteri reddetti | `quote:rejected` | STAFF_ROOM |

- **Ephemeral** (personel çevrimdışıysa banner kaybolur) — ama kalıcı iz `QuoteEvent`'te
  durur, teklif detayında/timeline'da görülür. Kalıcı bell-inbox v1 dışı (§0).
- Müşteri tarafına bildirim YOK (link ile eylem yapıyor; e-posta ertelendi).
- Frontend: mevcut eskalasyon banner handler'ını aynala (socket listener → toast/banner).

---

## §4 P2 Timeline entegrasyonu (bu sefer zorunlu)

P3a'da opsiyonel bırakılan bağ P3b'de kapatılır: `QuoteEvent` müşteri timeline'ının
**5. kaynağı** olur.
- `backend/utils/customerTimeline.js`: `buildTimeline`'a `quoteEvents` parametresi +
  `mapQuoteEvents` (created/sent/viewed/accepted/rejected/invoiced → normalize item).
- `backend/controllers/customerController.js` `getCustomerTimeline`: Quote id'lerini
  müşteriye göre çek → QuoteEvent'leri getir → merge. **RBAC:** teklif olayları hassas
  (ciro) → deal olayları gibi `PERMISSIONS.deals.read`/`quotes.read` filtresiyle
  intern'e gösterilmez (P2'deki deal filtresi deseni).
- `frontend/src/utils/customerTimeline.js` `EVENT_META`: `quote:*` satırları + i18n.

---

## §5 RBAC

Yeni kaynak (backend `config/permissions.js` + frontend aynası):
```js
salesInvoices: {
  read:  [SUPER_ADMIN, STAFF, ACCOUNTANT],
  write: [SUPER_ADMIN, STAFF, ACCOUNTANT], // satış üretir, muhasebe ödeme işler
},
```
- `quotes.write` zaten send/invoice-üret/revise'i kapsar (P3a).
- **Public uçlar auth'suz** — token + rate-limit + status guard ile korunur (§6).
- intern her yerde hariç (teklif/fatura tutarı hassas ciro).
- `OVERRIDABLE_RESOURCES`'a eklenmez.

---

## §6 Güvenlik (public uç kritik)
- **Token:** `crypto.randomBytes(24).hex` (48 hane), sparse unique index, tahmin edilemez.
  Response/gövdede echo edilmez, loglanmaz.
- **Rate limit:** `publicQuoteRateLimiter` (leadRateLimiter deseni) view/accept/reject'e.
- **İdempotent geçiş:** accept/reject sadece `status='sent'` + `validUntil` geçmemişken;
  zaten yanıtlanmışsa 409, süresi geçmişse 410. Çift-tık güvenli.
- **Bilgi sızıntısı:** public GET whitelist alanlar döner; geçersiz token → 404
  (var/yok ayrımı sızdırmadan). `draft` teklif public'te 404.
- **Fatura immutability:** `void`/`paid` sonrası kalem değişmez; sadece izinli PATCH.
- Public uçlar cookie/oturum kullanmaz → CSRF yüzeyi yok (saf token-in-URL).

---

## §7 v1 sınırları / opsiyonel notlar
- E-posta gönderimi, kalıcı bildirim kutusu, e-Fatura/GİB → kapsam dışı.
- **Opsiyonel (varsayılan kapalı):** teklif kabul edilince bağlı `Deal` açıksa
  `won`'a taşımayı ÖNER (otomatik değil — yanlış tık riski). İstenirse küçük ek.
- Sunucu-taraf sayfalama (fatura/teklif listesi) → P4.

---

## §8 Doğrulama (uygulama sonrası)
- **Uçtan uca akış:** teklif gönder → token al → public GET (viewedAt set + staff
  `quote:viewed` socket) → public POST accept → status=accepted → iç POST /invoice →
  fatura unpaid → POST /payments (kısmi) → partial → tam ödeme → paid.
- **Güvenlik:** geçersiz token 404; çift accept 409; süresi geçmiş accept 410;
  draft teklif public'te 404.
- **RBAC:** intern `/api/quotes`+`/api/sales-invoices` 403; accountant read OK,
  fatura ödeme yazabilir; public uçlar auth'suz çalışır.
- **PDF:** fatura `/:id/pdf` `%PDF` magic byte + boyut>0.
- **Timeline:** kabul/ret olayı müşteri timeline'ında görünür; intern'de görünmez.
- Puppeteer görsel script (P2 deseni): teklif detayında public link kopyala, public
  sayfada kabul et, faturaya dönüştür, ödeme işle.

---

## §9 Sonnet için dosya listesi
**Backend yeni:** `config/salesInvoices.js`, `models/Invoice.js`, `models/QuoteEvent.js`,
`utils/invoicePdf.js`, `utils/quoteNotify.js`, `controllers/publicQuoteController.js`,
`controllers/salesInvoiceController.js`, `routes/publicQuoteRoutes.js`,
`routes/salesInvoiceRoutes.js`, `validators/salesInvoiceValidators.js`,
`validators/publicQuoteValidators.js`.
**Backend değişen:** `models/Quote.js` (+publicToken/publicViewedAt/respondedAt/rejectionReason),
`controllers/quoteController.js` (send→token+QuoteEvent; +generateInvoice; create/send/revise'e
QuoteEvent yazımı), `routes/quoteRoutes.js` (+/invoice), `config/permissions.js` (+salesInvoices),
`middleware/security.js` (+publicQuoteRateLimiter), `server.js` (public + sales-invoice mount),
`utils/customerTimeline.js` (+mapQuoteEvents), `controllers/customerController.js`
(getCustomerTimeline'a QuoteEvent kaynağı + RBAC filtresi).
**Frontend yeni:** `pages/PublicQuote.jsx` (girişsiz görüntüle/kabul/ret), `pages/SalesInvoices.jsx`,
`services/publicQuoteService.js`, `services/salesInvoiceService.js`, `hooks/useSalesInvoices.js`,
`hooks/useSalesInvoice.js`, `components/invoices/InvoiceDetailDrawer.jsx`,
`components/invoices/RecordPaymentForm.jsx`, `config/salesInvoices.js`.
**Frontend değişen:** `App.jsx` (public rota `/q/:token` — layout DIŞI + `/sales-invoices`),
`config/navigation.js` (+Faturalar), `config/permissions.js` (+salesInvoices),
`components/quotes/QuoteDetailDrawer.jsx` (public link kopyala, status rozetleri,
"Faturaya Dönüştür" — accepted'ta), socket banner handler (eskalasyon deseni),
`utils/customerTimeline.js` (+quote:* EVENT_META), `i18n/en.json`, `i18n/tr.json`, `index.css`.

**Uygulama sırası (P3a bittikten sonra, aşamalı):**
1. `QuoteEvent` + send'e token/event ekle + public route (view/accept/reject) + rate-limit.
2. Public teklif sayfası (frontend, layout dışı rota).
3. Fatura modeli + köprü (`/quotes/:id/invoice`) + sales-invoice CRUD + ödeme + PDF.
4. Fatura frontend (liste + drawer + ödeme).
5. Bildirim (socket emit + banner) + P2 timeline entegrasyonu.
