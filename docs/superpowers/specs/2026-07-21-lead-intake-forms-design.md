# Lead Intake & "Formlar" Paneli — Tasarım

Tarih: 2026-07-21 | Durum: Onay bekliyor | Mimari: Opus · Uygulama: Sonnet · Görsel: Fable

## Amaç

İki katmanlı bir sistem: (1) **Dış talep formu** — ziyaretçilerin (henüz müşteri olmayan)
doldurduğu, tipe göre alanları açılan public form; (2) **İç "Formlar" paneli** — ekibin gelen
talepleri (lead) okuduğu, durum ilerlettiği, skorlanmış liste + detay drawer'ı. Aradaki köprü
kural-tabanlı **skorlama katmanı**.

Bu, projenin **ilk gerçekten anonim (auth'suz) yüzeyi**. Şimdiye kadar her endpoint `protect`
(JWT) veya portal login arkasındaydı — bu yüzden güvenlik tarafı ayrıca ele alınıyor (§3).

> **Stack notu:** Örnek spec Tailwind + genel "leads" SQL şeması varsayıyor. Bu proje MongoDB +
> plain CSS (index.css token sistemi). Görsel tasarım (form + panel yerleşimi) ayrı bir **Fable**
> pass'inde yapılacak; bu doküman **veri modeli, akış, yetki ve davranışı** tanımlar, piksel-düzeyi
> stil değil. Frontend iş mantığı hook/service katmanında, DOM'dan ayrık tutulur (mobil port hedefi).

## Jenerik spec'ten sapmalar (kod tabanına göre düzeltmeler)

1. **`lead_events` → hash-zincirli AuditLog DEĞİL, `LeadEvent` (TaskActivity deseni).** Örnek
   spec "audit modülünü yeniden kullan" diyor. Bu projede iki ayrı audit var:
   [AuditLog](../../../backend/models/AuditLog.js) SOC2/ISO tarzı **hash-zincirli**, transaction
   başına yazan, güvenlik-kritik bir yapı ([auditChain.js](../../../backend/utils/auditChain.js));
   [TaskActivity](../../../backend/models/TaskActivity.js) ise hafif, denormalize, operasyonel
   aktivite logu. Lead durum geçişleri yüksek-frekanslı, düşük-güvenlik operasyonel olaylar →
   **TaskActivity deseni doğru emsal**, hash zinciri değil (zinciri gereksiz şişirir + yavaşlatır).
2. **`user_id` (otomatik bağla) → `Customer` modeline bağlama.** Örnek spec "existing customers"
   diyor; bu projede o [Customer](../../../backend/models/Customer.js) (email `unique`). "User"
   iç personel, "CustomerUser" portal login'i — ikisi de değil. Alan adı: `linkedCustomer`.
3. **"Tek tık Kanban görevine çevir" tam tek-tık olamaz.** [Task](../../../backend/models/Task.js)
   `department` ve `assignedTo` **required** — dönüşüm küçük bir modal ister (departman + kişi seç,
   başlık lead'den ön-dolu). Yine de akıcı; §9.
4. **İç bildirim badge'i sıfırdan değil.** [Sidebar.jsx](../../../frontend/src/components/layout/Sidebar.jsx)
   zaten `pendingUsers`/`pendingApprovals` (polling) ve `chatEscalations` (socket) badge'lerini
   taşıyor. Yeni `newLeads` badge'i aynı desene eklenir (§7).
5. **SMTP hiç yok** → feature-flag (`MAIL_ENABLED=false`) yaklaşımı greenfield ve tutarlı (§6).

---

## 1) Backend Modelleri

### `Lead` — `backend/models/Lead.js` (yeni)

```
type:         String, enum ['quote','idea','question'], required
name:         String, required, trim, maxlength 100
email:        String, required, lowercase, trim, match e-posta regex
phone:        String, default '', trim, maxlength 30          // opsiyonel
company:      String, default '', trim, maxlength 120         // opsiyonel
budgetRange:  String, default null                            // sadece type='quote'
timeframe:    String, default null                            // sadece type='quote'
message:      String, required, trim, maxlength 4000
score:        Number, default 0                               // ingestion'da hesaplanır (§5)
temperature:  String, enum ['hot','warm','cold'], default 'cold'   // score'dan türetilir
status:       String, enum ['new','in_review','contacted','quoted','won','lost'], default 'new'
assignedTo:   ObjectId ref 'User', default null
linkedCustomer: ObjectId ref 'Customer', default null        // email eşleşirse (§8)
source:       String, default ''                             // Referer / landing sayfası
ip:           String, default null
userAgent:    String, default null
kvkkConsentAt: Date, required                                 // onaysız kayıt oluşmaz
timestamps: true
```

**Karar — `score`/`temperature` saklanır (denormalize).** Kural-tabanlı, deterministik ve
girişte hesaplanıyor; her okunuşta yeniden hesaplamak yerine kaydediyoruz (bkz. Project.progress'te
**tersini** yaptık çünkü o Task'lara bağlı canlı bir türev; skor ise lead'in kendi statik
alanlarından tek seferlik). Kurallar değişirse tek seferlik bir migration script'i yeniden hesaplar.

İndeksler: `{ status: 1, createdAt: -1 }` (panel liste sorgusu), `{ temperature: 1 }`,
`{ email: 1 }` (auto-link + tekrar-gönderim tespiti).

### `LeadEvent` — `backend/models/LeadEvent.js` (yeni, TaskActivity aynası)

Operasyonel zaman çizelgesi: durum geçişleri, atama, not eklenmesi. Denormalize snapshot'lar
(TaskActivity'deki gibi) ki liste/timeline Lead'e/User'a join yapmadan render edilsin.

```
lead:        ObjectId ref 'Lead', required
actor:       ObjectId ref 'User', required
actorName:   String, required            // denormalize
action:      String, enum ['created','status_changed','assigned','note_added'], required
fromStatus:  String, default null
toStatus:    String, default null
note:        String, default null        // action='note_added' için
timestamps: { createdAt: true, updatedAt: false }
```

> `note_added`'ı ayrı bir `lead_notes` tablosu yerine LeadEvent içinde birleştirdik: notlar da
> zaten kronolojik timeline'ın parçası, ayrı koleksiyon gereksiz. (Örnek spec ikisini ayırıyordu.)

**Güvenlik-kritik istisna:** Lead **silme** (`delete`) hash-zincirli AuditLog'a da yazılabilir —
bunun için AuditLog enum'una `'Lead'` eklenir. Ama bu **opsiyonel/sonraki faz**; v1'de lead silme
yok (sadece `lost` durumu), o yüzden başlangıçta AuditLog'a dokunmuyoruz.

## 2) Public Form Bileşeni (Dış Katman)

Tek dev form yerine **önce tip sor**: `Fiyat teklifi` / `Proje fikri` / `Genel soru`. Tip
seçimine göre alanlar açılır:
- **Zorunlu (her tip):** Ad soyad, E-posta, Tip, Talep metni, KVKK onayı.
- **Sadece `quote`:** Bütçe aralığı (select), Ne zaman başlamak istersiniz (select).
- **Her zaman opsiyonel:** Şirket, Telefon. (Telefonu zorunlu yapmak dönüşüm oranını düşürür.)

Bu form **auth'suz** bir sayfada yaşar (örn. `/talep` veya gömülebilir). Bileşen yapısı §10.

## 3) Public Ingestion Endpoint + Güvenlik ⚠️ (ilk anonim yüzey)

**Router bölünür:** `POST /api/leads` **public** (global `protect`'ten ÖNCE mount edilir);
diğer tüm lead endpoint'leri (`GET`, durum güncelleme, not, atama) `protect` arkasında.

`server.js`'de mount sırası: public lead router `app.use(express.json)` sonrası ama korumalı
route'lardan bağımsız — auth middleware'i sadece `/api/leads`'in korumalı alt-router'ına takılır.

**Katmanlı spam/kötüye-kullanım savunması:**
- **Honeypot:** Forma gizli bir alan (örn. `website`); dolu gelirse **sessizce 200 dön, kaydetme**
  (bot'a başarı sinyali ver, gerçek işlem yapma).
- **3. rate limiter:** [security.js](../../../backend/middleware/security.js)'de `authRateLimiter`
  deseninin aynısı — `leadRateLimiter` (IP başına dakikada 3-5). Sadece public `POST /api/leads`'e.
  (Global 15dk/300 ve auth 15dk/20 zaten var; bu üçüncüsü.)
- **Validasyon:** `express-validator` ile (mevcut `handleValidationErrors` deseni). `type` enum,
  email format, `message` uzunluk, `kvkkConsent === true` zorunlu. `mongoSanitize`+`hpp` zaten global.
- **Meta yakalama:** `ip` (`req.ip`, `trust proxy` ayarı gerekebilir — Atlas/proxy arkasındaysa),
  `userAgent` (`req.get('user-agent')`), `source` (`req.get('referer')`). İstemciden gelen değil,
  sunucuda türetilir.
- **KVKK:** `kvkkConsentAt = new Date()` yalnızca onay true ise. Aydınlatma metni linki formda.

Ingestion akışı: validate → honeypot kontrol → skorla (§5) → email ile Customer ara (§8) →
`Lead.create` → `LeadEvent(action:'created')` → iç bildirim tetikle (§7) → 201 (ince yanıt,
skor/temperature'ı public'e sızdırma; sadece "alındı").

## 4) RBAC: `leads` Kaynağı

[permissions.js](../../../backend/config/permissions.js) `PERMISSIONS`'a yeni kaynak (çift dosya —
frontend kopyası da güncellenir):

```js
leads: {
  read:   [SUPER_ADMIN, STAFF],
  write:  [SUPER_ADMIN, STAFF],   // durum geçişi, atama, not
},
```

**Karar/açık soru:** `support` lead'leri görsün mü? Support şu an chat + feedback ticket'larını
işliyor; lead'ler satış-öncesi. Öneri: **v1'de super_admin + staff**, support sonra. `intern`
dahil edilmedi — lead'ler ham PII (email/telefon) taşıyor; intern read-only rollout'una eklenirse
[redactForIntern](../../../backend/middleware/redactForIntern.js) ile maskelenmeli (sonraki faz).

Not: Lead durum geçişleri **`authorizeOrQueue` onay kuyruğuna girmez** — bu, müşteri verisi
düzenlemesi gibi geri-alınması hassas bir işlem değil; basit tutulur (feedbacks'in `updateStatus`
deseni gibi doğrudan yetki).

## 5) Skorlama Motoru (kural-tabanlı)

`backend/utils/leadScoring.js` (saf fonksiyon, DOM/DB'siz — test edilebilir):

```
Bütçe 150k+           → +3   (belirtilmemiş → 0)
Zaman "1 ay içinde"   → +2
Kurumsal email        → +1   (gmail/hotmail/outlook/yahoo değilse)
Tip = quote           → +2   (question → 0)
```
Temperature: `score >= 6 → hot`, `3–5 → warm`, `< 3 → cold`.

Panelde tek satır otomatik özet: `"Fiyat teklifi · 50k–150k · 1 ay içinde · kurumsal e-posta"`
(saf format fonksiyonu, i18n'li). **AI özet katmanı bilerek kapsam dışı** — kural-tabanlı yaklaşım
sıfır operasyonel maliyetle değerin %80'ini verir; ham `message` analizi sonraki iterasyon.

## 6) Feature Flag Mimarisi (Mail/Arama — greenfield)

`disabled` HTML yazmak yerine flag deseni:
- **Config:** `.env` → `MAIL_ENABLED=false`, `CALL_ENABLED=false`. `backend/config/features.js`
  bunları tek yerden okur.
- **MailService arayüzü baştan yazılır:** `backend/services/mailService.js` → `sendQuoteReply(lead, template)`.
  Flag kapalıyken **gerçekten göndermez**: olayı log'a + `LeadEvent`/`outbox` benzeri bir kayda yazar.
  Tüm pipeline çalışır, sadece son adım (SMTP) susar. Aktifleştirme = tek satır config, kod değişmez.
- **Frontend flag okuma:** Yeni `GET /api/config` (authed, hafif) → `{ mailEnabled, callEnabled }`.
  Buton flag kapalıysa **soluk** render + hover'da "Yakında aktifleşecek" ipucu. `tel:` linki de
  hazır, `CALL_ENABLED` ile açılır.
- **İç ≠ dış:** Müşteriye mail (dış) ile panele bildirim (iç) ayrı; iç bildirim **1. günden açık** (§7).

## 7) İç Bildirim (badge — 1. günden açık)

Mevcut sidebar badge altyapısı birebir kullanılır. [Sidebar.jsx](../../../frontend/src/components/layout/Sidebar.jsx)
zaten `super_admin` için `pendingUsers`/`pendingApprovals`'ı 60sn'de bir polling'liyor;
`newLeads` (status='new' sayısı) aynı `fetchPending` bloğuna eklenir, nav item'a `badgeKey:'newLeads'`.
Slack/Telegram webhook'u opsiyonel/sonraki faz — badge tek başına "paneli sürekli yenileme" derdini çözer.

## 8) Customer Otomatik Bağlama

Ingestion'da `Customer.findOne({ email })` — varsa `lead.linkedCustomer = customer._id`. Panelde
"mevcut müşteri" rozeti gösterilir. Email `unique` olduğundan tek eşleşme garanti. Yeni müşteri
oluşturmaz (lead ≠ customer); sadece bağ kurar.

## 9) Lead → Görev Dönüşümü (Faz 6)

`won` bir lead'i Kanban görevine çevirme: [Task](../../../backend/models/Task.js) `department` +
`assignedTo` required olduğundan **küçük bir modal** (departman + kişi seç; başlık lead'den ön-dolu,
açıklama = lead.message). Onaylanınca `Task.create` + `LeadEvent(note_added: "Göreve dönüştürüldü")`.
Böylece form motoru proje/takvim akışına tam bağlanır.

## 10) Frontend Yapısı

**Public taraf** (auth'suz route, App.jsx'te `<Layout>` dışında):
- `pages/LeadForm.jsx` + `hooks/useLeadForm.js` (tip-state, koşullu alanlar, submit).
- `services/leadService.js` → `submit(payload)` (public), + authed panel çağrıları.

**İç panel** (Formlar sayfası — mevcut sayfa desenleriyle):
- `pages/Leads.jsx` — durum sekmeleri (Tümü/Yeni/İncelemede/…), skorlanmış liste satırları
  (temperature rozeti + tek-satır özet).
- `components/leads/LeadDetailDrawer.jsx` — **portal'lı** drawer (bkz. proje hafızası:
  `.page-container` position:fixed'i hapsediyor → `createPortal(document.body)`). Detay + durum
  değiştir + not ekle + (flag'li) Mail/Ara butonları + Göreve çevir.
- `hooks/useLeads.js` — TaskBoard/useTasks deseni: liste + optimistic durum güncelleme.
- Navigasyon: [navigation.js](../../../frontend/src/config/navigation.js) `main` veya yeni bölüme
  "Formlar" item'ı (`badgeKey:'newLeads'`), `roles:[SUPER_ADMIN, STAFF]`.
- i18n (tr/en) + index.css token'ları (Fable görsel pass'i burada devreye girer).

## 11) Uygulama Yol Haritası (Sonnet)

- **Faz 1:** `Lead`+`LeadEvent` modelleri · public ingestion endpoint · güvenlik (honeypot +
  leadRateLimiter + validasyon + meta yakalama + KVKK) · skorlama util'i · public form UI.
- **Faz 2:** `leads` RBAC · panel liste (sekme+skor) · detay drawer · durum geçişi pipeline'ı ·
  LeadEvent timeline.
- **Faz 3:** `newLeads` badge (iç bildirim) · Customer auto-link rozeti.
- **Faz 4:** Feature flag altyapısı (`GET /api/config`, mailService iskeleti) · soluk Mail/Ara butonları.
- **Faz 5 (opsiyonel):** Lead → Görev dönüşümü · yanıt şablonları · AI özet katmanı · support/intern erişimi.

## 12) Kararlar (kilitlendi 2026-07-21)

1. ✅ **Form konumu:** Ayrı bir route olarak (`/talep`) yazılır ama **deploy/domain işine
   girilmez** — v1'de uygulama içinde test edilir. Gerçek dış yayın sonraya.
2. ✅ **Yetki:** **super_admin + staff** (support ve intern v1'de hariç).
3. ✅ **Intern:** v1'de lead erişimi **yok** (PII maskeleme gelecekte gerekirse).
4. ✅ **Enum'lar (varsayılan kabul edildi):**
   - Bütçe (`budgetRange`): `<50k` · `50k-150k` · `150k-500k` · `500k+` · `belirtilmemiş`
   - Zaman (`timeframe`): `hemen` · `1_ay_icinde` · `1_3_ay` · `belirsiz`
   - Skorlama: `150k-500k`/`500k+` → +3; `hemen`/`1_ay_icinde` → +2 (§5).
