# Micro-CRM — 6 Özellik İçin Mimari Plan

> Bu bir **tasarım dokümanıdır** — kod implementasyonu içermez. Onaylandıktan sonra Sonnet ile kodlanacak. Format, önceki RBAC mimari planıyla tutarlıdır (bölüm numaraları, tablolar, dosya listeleri, "Critical Files").

## 0. Yönetici Özeti ve Bağımlılık Grafiği

Altı özellik birbirine bağımlı. Doğru sıra kritik çünkü bazı özellikler diğerlerinin altyapısı üzerine oturuyor:

```
Faz 0 (Güvenlik temeli — HEMEN)     → #5 validation + hardening (chat'ten ÖNCE)
        │
Faz 1  → #6 AuditLog  ───────────────┐ (bağımsız, erken yapılabilir)
        │                            │
Faz 2  → #2 Zorunlu şifre değiştirme │ (küçük, AuditLog'a hafif bağlı)
        │                            │
Faz 3  → #4 Ortak Sidebar birleştirme│ (chat sayfası buna eklenecek → chat'ten ÖNCE)
        │                            │
Faz 4  → #1 Harcama dashboard geliştirme (bağımsız, paralel yapılabilir)
        │                            │
Faz 5  → #3 Canlı chat (EN BÜYÜK) ───┘ (Sidebar + güvenlik + audit üzerine oturur)
```

**Kritik sıralama gerekçeleri:**
- **#5 (güvenlik) önce**: chat WebSocket katmanı eklendiğinde güvenlik deseni (validation, rate-limit, sanitization) zaten kurulu olmalı; sonradan eklemek daha pahalı.
- **#4 (Sidebar) chat'ten önce**: chat hem iç panele hem portala "Mesajlar" menü öğesi ekleyecek; ortak parametrik Sidebar önce hazır olmalı ki chat linki tek yerde eklensin.
- **#6 (Audit) erken**: #2'deki şifre değişikliği ve tüm write endpoint'leri audit log'a yazacağı için audit altyapısı önce olmalı.

---

## 1. Özellik #5 — API Güvenliği Sertleştirme (FAZ 0, EN ÖNCELİKLİ)

Kullanıcı bunu "çok önemli" olarak işaretledi ve chat'ten önce yapılması gerekiyor. Mevcut durumda `applySecurity()` iyi bir temel (helmet, CORS, rate-limit, mongo-sanitize, hpp) ama **route-seviyesi input validation tamamen eksik** — `express-validator` kurulu ama hiç kullanılmıyor.

### 1.1 Katman 1 — `express-validator` ile Input Validation

**Desen**: Her yazma endpoint'i için `backend/validators/` altında bir `*.validators.js` dosyası; route'ta `authorize` middleware'inden sonra, controller'dan önce çalışan bir validation zinciri + ortak bir `handleValidationErrors` middleware.

| Endpoint | Validasyon kuralları |
|---|---|
| `POST /api/users` | `name`: trim, 2–50 char, harf/boşluk; `email`: isEmail + normalizeEmail; `role`: `isIn(ALL_ROLES)`; şifre üretiliyorsa client'tan alınmaz |
| `POST/PUT /api/customers` | `name`: 2–100 char; `email`: isEmail; `company`: opsiyonel maxlen; `plan`: `isIn([free,starter,premium,vip])`; `mrr`: isFloat min 0; `source`: enum; `notes`: maxlen 2000 escape |
| `POST/PUT /api/feedbacks` | `title`: 3–150; `description`: maxlen 2000 escape; `type`: `isIn([bug,feature,improvement])`; `status`/`priority`: enum; `customer`: isMongoId |
| `PATCH /api/portal/profile` | `name`: 2–50; `email`: isEmail normalizeEmail |
| `PATCH /api/portal/auth/password` & yeni şifre endpoint'leri | `currentPassword`: notEmpty; `newPassword`: min 8, karmaşıklık (harf+rakam), `!==` current |
| Chat mesaj (yeni, #3) | `content`: trim, 1–2000 char, escape/sanitize; `conversationId`: isMongoId |

**Ortak kural**: tüm string alanlarda `.trim().escape()` (XSS için), tüm ObjectId alanlarında `.isMongoId()`, tüm enum'larda `.isIn(...)`. Bilinmeyen alanları reddetmek için body whitelist yaklaşımı (sadece beklenen alanları controller'a geçir).

### 1.2 Katman 2 — Helmet CSP (Content-Security-Policy)

Şu an `helmet()` varsayılan ile çağrılıyor; CSP varsayılan olarak **açık ama çok gevşek**. Açıkça bir `contentSecurityPolicy` direktifi tanımlanmalı: `default-src 'self'`, `connect-src 'self' <FRONTEND_URL> ws:/wss:` (WebSocket için gerekli), `img-src 'self' data:`, `script-src 'self'`. Chat WebSocket bağlantısı `connect-src`'a eklenmezse tarayıcı engeller — bu yüzden CSP tasarımı chat'ten önce netleşmeli.

### 1.3 Katman 3 — Brute-force / Hesap Kilitleme

Şu an sadece IP-bazlı rate-limit var (20 istek/15dk). Buna ek **hesap-bazlı kilitleme** öneriliyor: `User` ve `CustomerUser` modellerine `failedLoginAttempts: Number` ve `lockUntil: Date` alanları. 5 başarısız denemeden sonra hesap 15 dakika kilitlenir. `authController.login` her başarısız denemede sayacı artırır, başarılı girişte sıfırlar. Bu, IP rotasyonuyla rate-limit'i bypass eden saldırılara karşı korur.

### 1.4 Katman 4 — WebSocket Güvenliği (chat ile birlikte, #3'e bağlı)

- Socket.io handshake'de JWT doğrulama (aşağıda #3.4).
- `maxHttpBufferSize` düşürülmüş (örn. 16 KB) — büyük payload DoS'a karşı.
- Mesaj başına rate-limit: kullanıcı başına saniyede N mesaj (socket seviyesinde in-memory sayaç veya `rate-limiter-flexible`).
- Mesaj içeriği sunucu tarafında sanitize edilir (HTML escape) — client'a asla ham HTML olarak render edilmez.

### 1.5 Katman 5 — Operasyonel / İzleme

- **Refresh token / kısa ömürlü access token**: şu an 7 gün tek token, iptal mekanizması yok. Öneri (opsiyonel/ileri faz): 15 dk access + 7 gün refresh token, refresh'ler DB'de tutulup iptal edilebilir. Acil değil ama not düşülmeli.
- **JWT_SECRET rotasyonu**: üç servis paylaşıyor; secret rotasyonu için `kid` (key id) claim'i ve iki-secret geçiş penceresi düşünülebilir (ileri faz).
- **`npm audit`**: CI'a `npm audit --audit-level=high` adımı eklenmesi önerisi.
- **HTTPS zorunluluğu**: production'da `app.set('trust proxy', 1)` + HSTS (helmet ile) + HTTP→HTTPS redirect (reverse proxy seviyesinde).
- **Güvenlik loglama**: başarısız login, kilitlenme, yetki reddi (403) olayları structured log olarak yazılmalı — audit log (#6) ile örtüşür ama audit "veri değişikliği", security-log "erişim olayı" odaklı; ikisi ayrı tutulmalı.
- **express.json limit**: şu an `1mb` — makul; chat için ayrı ve daha düşük tutulmalı.

### 1.6 Öncelik-Sıralı Sertleştirme Checklist'i

| # | Madde | Öncelik | Faz | Not |
|---|---|---|---|---|
| 1 | Tüm write endpoint'lerine `express-validator` şemaları | 🔴 Acil | 0 | En büyük açık |
| 2 | Helmet CSP açık tanımı (ws/wss dahil) | 🔴 Acil | 0 | Chat'ten önce |
| 3 | Body whitelist (mass-assignment koruması) | 🔴 Acil | 0 | role/status enjeksiyonunu engeller |
| 4 | Hesap-bazlı kilitleme (failedLoginAttempts/lockUntil) | 🟠 Yüksek | 0-1 | IP rate-limit yetmez |
| 5 | WebSocket auth + mesaj rate-limit + sanitize | 🟠 Yüksek | 5 | Chat ile |
| 6 | `npm audit` CI adımı + bağımlılık güncelleme | 🟡 Orta | 1 | |
| 7 | Güvenlik olay loglama (403/başarısız login) | 🟡 Orta | 1 | Audit ile örtüşür |
| 8 | HTTPS/HSTS/trust proxy (prod) | 🟡 Orta | Deploy | Altyapı |
| 9 | Refresh token + kısa access token | 🟢 Düşük | İleri | Büyük refactor |
| 10 | JWT_SECRET rotasyon mekanizması | 🟢 Düşük | İleri | |

### Dosyalar

- `[NEW]` `backend/validators/userValidators.js`, `customerValidators.js`, `feedbackValidators.js`, `portalValidators.js`, `chatValidators.js`
- `[NEW]` `backend/middleware/validate.js` (ortak `handleValidationErrors`)
- `[MODIFY]` `backend/middleware/security.js` (CSP direktifleri, gerekirse `helmet` yapılandırması)
- `[MODIFY]` `backend/routes/userRoutes.js`, `customerRoutes.js`, `feedbackRoutes.js`, `portalRoutes.js` (validator zincirlerini ekle)
- `[MODIFY]` `backend/controllers/authController.js` (kilitleme mantığı)
- `[MODIFY]` `backend/models/User.js`, `backend/models/CustomerUser.js` (kilitleme alanları)

---

## 2. Özellik #6 — Audit Log (FAZ 1)

Amaç: admin panelinden yapılan User/Customer değişiklikleri VE müşterinin portal profilinden yaptığı değişikliklerin DB'ye gerçekten yansıdığını süper admin'in doğrulayabilmesi.

### 2.1 Veri Modeli — `[NEW]` `backend/models/AuditLog.js`

| Alan | Tip | Açıklama |
|---|---|---|
| `collectionName` | String enum `['User','Customer','CustomerUser','Feedback','Conversation']` | Hangi koleksiyon |
| `documentId` | ObjectId | Etkilenen kayıt |
| `action` | String enum `['create','update','delete']` | İşlem |
| `actor` | ObjectId | Kim yaptı (User veya CustomerUser) |
| `actorType` | String enum `['internal','customer','system']` | Aktör tipi |
| `actorEmail` | String | Denormalize — aktör silinse bile iz kalsın |
| `changes` | `[{ field, before, after }]` | Alan-bazlı diff (yalnız update'te) |
| `snapshot` | Mixed (opsiyonel) | create/delete'te tam kayıt görüntüsü |
| `ip` / `userAgent` | String | İsteğin kaynağı |
| `timestamps` | | `createdAt` = ne zaman |

İndeksler: `{ collectionName: 1, documentId: 1 }`, `{ actor: 1 }`, `{ createdAt: -1 }`.

### 2.2 Yakalama Stratejisi — Kararı: Controller-seviyesi (Mongoose hook DEĞİL)

**Trade-off analizi:**

| Yaklaşım | Artı | Eksi |
|---|---|---|
| Mongoose `post('save')` hook | Otomatik, unutulmaz | Aktör/IP/before-değeri hook içinde YOK (request context'e erişemez); `updateOne`/`findByIdAndUpdate` gibi query-middleware'ler `this`'i doküman olarak vermez; before/after diff üretmek zor |
| **Controller-seviyesi (ÖNERİLEN)** | Aktör, IP, before/after diff'e tam erişim; hangi olayın loglanacağı açık kontrol | Her write controller'ında açık çağrı gerekir (unutma riski) |

**Öneri: Controller-seviyesi + ince bir `auditService` yardımcısı.** Aktör bilgisi (`req.user`/`req.customerUser`), IP ve before/after diff sadece request katmanında mevcut olduğu için hook'lar yetersiz. Unutma riskini azaltmak için: write controller'larında `before = await Model.findById(...)` → işlem → `auditService.record({...})` deseni standartlaştırılır ve `[NEW]` `backend/utils/auditService.js` içinde tek fonksiyonda toplanır. Diff hesaplama (`computeDiff(before, after, watchedFields)`) bu util'de.

Loglanacak akışlar: `POST/PUT/DELETE /api/users`, kullanıcı approve/reject, `POST/PUT/DELETE /api/customers`, `grantPortalAccess`, `PATCH /api/portal/profile`, `PATCH /api/portal/auth/password` (sadece "şifre değişti" — değeri ASLA loglanmaz), Feedback status değişimleri.

### 2.3 API — `[NEW]` `backend/routes/auditRoutes.js` + `auditController.js`

- `GET /api/audit-logs` — süper admin only; query filtreleri: `collectionName`, `documentId`, `actor`, `action`, `dateFrom`, `dateTo`, sayfalama (`page`, `limit`). `authorize` yeni bir `auditLog` kaynağı (`read: [SUPER_ADMIN]`) ile korunur.
- `GET /api/audit-logs/:id` — tek kayıt detay (diff görünümü).

### 2.4 Frontend

- `[NEW]` `frontend/src/pages/AuditLog.jsx` — filtrelenebilir tablo (koleksiyon, kayıt, aktör, tarih aralığı dropdown/date-picker), her satır genişletilince before/after diff gösterir.
- `[NEW]` `frontend/src/services/auditService.js`
- `[MODIFY]` `frontend/src/App.jsx` (yeni route, `RoleGuard allow={[SUPER_ADMIN]}`)
- `[MODIFY]` Sidebar admin bölümüne "Denetim Kaydı" öğesi (Faz 3 ortak Sidebar'a).
- `[MODIFY]` `backend/config/permissions.js` + `frontend/src/config/permissions.js` (`auditLog` kaynağı).

---

## 3. Özellik #2 — Zorunlu İlk Giriş Şifre Değişikliği (FAZ 2)

### 3.1 Veri Modeli

- `[MODIFY]` `backend/models/User.js`: `mustChangePassword: { type: Boolean, default: false }`.
- `[MODIFY]` `backend/models/CustomerUser.js`: aynı alan.
- Admin `POST /api/users` ile hesap oluşturduğunda ve `grantPortalAccess` ile portal erişimi açıldığında (geçici şifre üretimi) → `mustChangePassword: true`.

### 3.2 Backend Akışı

- **JWT claim'i**: `generateInternalToken` / `generatePortalToken` içine `mustChangePassword` claim'i eklenir; `/auth/me` yanıtına da eklenir (frontend flag'i buradan okur).
- **Yeni endpoint**: `[NEW]` `PATCH /api/auth/change-password` — hem internal hem portal için çalışan birleşik endpoint (`identify` middleware ile), `currentPassword` + `newPassword` alır, doğrular, `mustChangePassword = false` yapar, YENİ token döner (claim güncellensin diye). Portal tarafındaki mevcut `PATCH /api/portal/auth/password` da `mustChangePassword`'ı sıfırlamalı (tutarlılık için ikisi de aynı util'i kullanmalı).
- **Sunucu-taraflı zorlama (kritik)**: sadece frontend yönlendirmesi yetmez. `mustChangePassword === true` olan bir token, şifre-değiştirme dışındaki tüm korumalı endpoint'lerde **reddedilmeli** (`protect`/`protectPortal`/`identify` içinde kontrol). Aksi halde kullanıcı API'yi doğrudan çağırarak zorlamayı atlar. İzin verilen endpoint'ler beyaz listesi: `/auth/change-password`, `/auth/me`, `/auth/logout`.
- Bu şifre değişikliği #6 audit log'a yazılır (`action: update`, `changes: [{field:'password', before:'***', after:'***'}]`).

### 3.3 Frontend

- `[NEW]` `frontend/src/pages/ForcePasswordChange.jsx` — sade form (mevcut şifre + yeni şifre + tekrar).
- `[MODIFY]` `frontend/src/context/AuthContext.jsx` — session'a `mustChangePassword` yansıtılır; başarılı şifre değişikliğinde yeni token set edilir.
- `[MODIFY]` `frontend/src/App.jsx` — bir `PasswordGate` wrapper'ı (`ProtectedRoute` altında, hem portal hem staff layout'unu sarmalar): `session.mustChangePassword === true` iken `/force-password-change` dışındaki her route `<Navigate to="/force-password-change" />`. Login sonrası doğal olarak buraya düşer.

---

## 4. Özellik #4 — Ortak Parametrik Sidebar (FAZ 3, chat'ten ÖNCE)

Kullanıcı "tüm proje aynı formatta ilerlesin" istiyor. Öneri: **tek, parametrik Sidebar bileşeni** — kod tekrarı olmadan hem internal hem portal menülerini render eder.

### 4.1 Mimari Karar

Mevcut `Sidebar.jsx` menü öğelerini `roles` ile filtreliyor. Bunu `accountType`-farkında hale getirmek yerine, **menü konfigürasyonunu veriden ayır**:

- `[NEW]` `frontend/src/config/navigation.js` — tek kaynak menü tanımı. İki set: `internalNav` (mevcut öğeler + `roles`) ve `portalNav` (Taleplerim, Profilim, Mesajlar). Her öğe: `{ path, icon, labelKey, roles?, section }`.
- `[MODIFY]` `frontend/src/components/layout/Sidebar.jsx` — bir `variant` / `accountType` prop'u (veya doğrudan `useAuth` ile `isCustomer` okuyarak) alır; `isCustomer` ise `portalNav`'ı, değilse `internalNav`'ı `role` filtresiyle render eder. Logo, tema toggle, pending-badge mantığı korunur (badge sadece internal + super_admin'de).
- `[MODIFY]` `frontend/src/components/layout/PortalLayout.jsx` — mevcut yatay navbar kaldırılır; `Layout.jsx` deseniyle aynı: sol `<Sidebar />` + üstte ince bir `Navbar` (çıkış + kullanıcı adı). Portal artık `app-layout` + `sidebar` + `main-content` (marginLeft'li) yapısını kullanır → iç uygulamayla görsel tutarlılık.
- `[MODIFY]` `frontend/src/components/layout/Layout.jsx` — muhtemelen değişiklik gerekmez, sadece Sidebar aynı bileşen olur.

Böylece ileride yeni rol/sayfa eklenince tek `navigation.js`'e eklenir, hem panel hem portal aynı desenle büyür.

### Dosyalar
- `[NEW]` `frontend/src/config/navigation.js`
- `[MODIFY]` `frontend/src/components/layout/Sidebar.jsx`, `PortalLayout.jsx`
- Portal navbar'daki çıkış butonu yeni yapıya taşınır.

---

## 5. Özellik #1 — Harcama Dashboard Genişletmesi (FAZ 4, bağımsız)

Mevcut `reportController.js` iki koleksiyonu (`invoices`, `invoicesv2`) doğrudan aggregate ediyor. Genişletmeler önceliklendirilmiş, hepsi zorunlu değil:

| Öncelik | Ekleme | Backend değişikliği | Frontend |
|---|---|---|---|
| 🔴 Yüksek değer/düşük efor | **Tarih aralığı filtresi** | `getSpendingSummary`'ye `?from&to` query; pipeline'a `$match` on `effectiveDate` | Date-picker + "bu ay/geçen ay/bu yıl" hızlı butonları |
| 🔴 | **Trend karşılaştırması (bu ay vs geçen ay)** | Zaten aylık kırılım var; iki ayın delta'sı + yüzde | Özet kartlarda ▲/▼ yüzde rozeti |
| 🟠 | **Satıcı/tedarikçi bazlı kırılım** | Yeni pipeline: `$group` by `vendorName` (+`vendorTaxNumber`), top-N | Yeni bar-chart bölümü (mevcut `.bar-chart` CSS) |
| 🟠 | **KDV oranına göre kırılım** | Fatura satır kalemlerinde KDV oranı varsa `$group` by rate (%1/%10/%20). *Açık soru: oran doküman seviyesinde mi, line-item mı?* | Bar/pie benzeri CSS chart |
| 🟡 | **PDF export** | Şu an CSV var. PDF için kütüphane gerekir (aşağı) | "PDF indir" butonu |

**PDF export teknoloji notu**: Frontend'de hiç grafik/PDF kütüphanesi yok. İki seçenek: (a) client-side `jspdf` + `jspdf-autotable` (yeni frontend bağımlılığı, basit tablolar için yeterli, sunucu yükü yok); (b) server-side `pdfkit`/`puppeteer` (daha ağır). **Öneri: client-side `jspdf`** — mevcut CSV zaten client'a veri veriyor, PDF de aynı veriden üretilebilir, altyapı minimal. Türkçe karakter için font gömme gerekir (not düşülmeli).

### Dosyalar
- `[MODIFY]` `backend/controllers/reportController.js` (tarih filtresi, vendor pipeline, KDV pipeline, trend)
- `[MODIFY]` `backend/routes/reportRoutes.js` (query paramlar; yeni `spending-vendors` endpoint opsiyonel)
- `[MODIFY]` `frontend/src/pages/SpendingDashboard.jsx` (filtreler, yeni bölümler, PDF butonu)
- `[MODIFY]` `frontend/src/services/reportService.js`
- `[NEW-opsiyonel]` `frontend/package.json` → `jspdf` bağımlılığı

---

## 6. Özellik #3 — Canlı Chat Sistemi (FAZ 5, EN BÜYÜK)

### 6.1 Teknoloji Kararı: **Socket.io**, ana `backend` servisine bağlı

| Seçenek | Değerlendirme |
|---|---|
| **Socket.io (ÖNERİLEN)** | Oda (room) / namespace desteği hazır → müşteri başına oda kolay; otomatik yeniden bağlanma (reconnection) built-in → "hata var mı" göstergesi için ideal; JWT handshake middleware kolay; fallback (long-polling) tarayıcı uyumu. Yeni bağımlılık: `socket.io` (backend) + `socket.io-client` (frontend) |
| Ham `ws` | Hafif ama oda/reconnect/ack'i elle yazmak gerekir — chat için gereksiz iş |
| Polling | Gerçek zamanlı değil, kullanıcının istediği "canlı" deneyimi vermez |

**Neden ana backend**: Chat verisi (Customer, CustomerUser, User, Feedback) ana backend'in MongoDB'sinde. Fatura mikroservisleri (5001/5002) OCR'a özel, chat'le ilgisiz. Socket.io ana backend'in HTTP server'ına bağlanır → `server.js`'de `app.listen` yerine `http.createServer(app)` + `io.attach(server)`.

### 6.2 Auth — Socket.io Handshake (mevcut `aud` ayrımıyla uyumlu)

Socket.io connection middleware (`io.use(...)`):
1. Client, handshake'de `auth: { token }` gönderir (localStorage `micro-crm-token`).
2. Middleware `jwt.verify` yapar, `aud` claim'ini okur (`identify.js` ile aynı mantık).
3. `aud: 'internal'` → User doğrula, `role`'ü `support/staff/super_admin` değilse **reddet**. `aud: 'portal'` → CustomerUser doğrula, `customerId`'yi socket'e bağla.
4. Socket'e `socket.data = { accountType, userId, role?, customerId? }` iliştirilir.
5. `mustChangePassword === true` ise bağlantı reddedilir (tutarlılık, #2 ile).

**Oda modeli**: Her müşteri için oda = `conversation:<customerId>`. Müşteri girince kendi odasına join olur. İç kullanıcı bir konuşma açınca o odaya join olur. Süper admin/support birden çok odaya join olabilir.

### 6.3 Veri Modeli Kararı: **Ayrı `Conversation` + `Message` (Feedback'ten BAĞIMSIZ)**

**Trade-off:**

| Yaklaşım | Artı | Eksi |
|---|---|---|
| Feedback'e bağla (her ticket'ın chat'i) | Mevcut assignedTo/atama deseni hazır | Chat "genel müşteri iletişimi", ticket ise "belirli sorun" — anlamsal uyumsuz; müşterinin aktif ticket'ı yokken chat açamaması saçma; Feedback şeması şişer |
| **Ayrı Conversation/Message (ÖNERİLEN)** | Müşteri başına kalıcı sohbet thread'i; ticket'tan bağımsız; sol panelde "ilişki" görünümüne doğal uyum; mesaj geçmişi temiz | Yeni iki model + yeni atama mantığı |

**Öneri: Müşteri başına 1 kalıcı `Conversation` + çok sayıda `Message`.** İleride gerekirse bir mesaj bir Feedback'e `relatedFeedback` ile referanslanabilir (opsiyonel köprü), ama chat ana olarak bağımsızdır.

- `[NEW]` `backend/models/Conversation.js`:
  `customer: ObjectId→Customer` (unique, müşteri başına tek), `assignedTo: ObjectId→User (default null)`, `status: enum['open','closed'] (default open)`, `lastMessageAt: Date`, `lastMessagePreview: String`, `unreadForCustomer: Number`, `unreadForStaff: Number`, timestamps.
- `[NEW]` `backend/models/Message.js`:
  `conversation: ObjectId→Conversation`, `senderType: enum['internal','customer','system']`, `senderId: ObjectId` (User veya CustomerUser), `senderName: String` (denormalize), `content: String (1–2000, sanitize)`, `status: enum['sent','delivered','read']`, `deliveryError: Boolean`, timestamps. İndeks: `{ conversation:1, createdAt:1 }`.

### 6.4 Atama Modeli Kararı: **`Feedback.assignedTo` desenini takip et + herhangi bir support/staff cevaplayabilir**

- Varsayılan: atanmamış konuşmalara **her** `support`/`staff`/`super_admin` cevap verebilir (hızlı yanıt için).
- Süper admin bir konuşmayı belirli bir kullanıcıya **atayabilir** (`assignedTo`) — atanınca sol panelde "Sorumlu: X" görünür ama diğerleri yine görebilir/gerekirse cevaplayabilir (yumuşak sahiplik; Feedback'teki gibi).
- Erişim rolleri (`permissions.js`'e yeni `chat` kaynağı): `read/write: [SUPER_ADMIN, STAFF, SUPPORT]`, `assign: [SUPER_ADMIN]`. `accountant` ve `intern` hariç (Feedback write deseniyle tutarlı; intern zaten salt-okunur felsefesi).

### 6.5 Gerçek Zamanlı Olaylar (Socket.io event sözleşmesi)

| Event | Yön | Payload |
|---|---|---|
| `message:send` | client→server | `{ conversationId, content, tempId }` (tempId optimistic UI + ack için) |
| `message:new` | server→room | tam Message dokümanı |
| `message:ack` | server→gönderen | `{ tempId, messageId, status:'sent' }` — gönderim başarı onayı |
| `message:error` | server→gönderen | `{ tempId, error }` — "hata var mı" göstergesi tetikler |
| `typing` | çift yön | `{ conversationId, isTyping }` |
| `message:read` | çift yön | okundu bilgisi |
| `presence` | server→room | karşı tarafın online/offline durumu |

Mesajlar önce DB'ye yazılır (kalıcılık), sonra `message:new` ile yayınlanır. Geçmiş mesajlar REST ile yüklenir (aşağıda), canlı akış Socket.io ile.

### 6.6 "Hata Var mı Yok mu" Kontrolü (kullanıcının özel isteği)

- **Bağlantı durumu göstergesi**: Socket.io `connect`/`disconnect`/`reconnect_attempt` olaylarına bağlı yeşil/sarı/kırmızı nokta ("Bağlı" / "Yeniden bağlanıyor" / "Bağlantı yok").
- **Mesaj gönderim durumu**: her mesaj optimistic olarak "gönderiliyor" (saat ikonu) → `message:ack` gelince "gönderildi" (✓) → `message:error` veya timeout'ta "başarısız" (kırmızı ünlem + "Tekrar dene" butonu → retry).
- **Retry mekanizması**: başarısız mesaj `tempId` ile client'ta tutulur; tekrar-dene aynı içeriği yeniden emit eder.

### 6.7 REST Endpoint'leri (Socket.io yanında — geçmiş, liste, atama)

`[NEW]` `backend/routes/chatRoutes.js` (internal) + portal route'a eklenecek chat endpoint'leri:

| Endpoint | Erişim | Amaç |
|---|---|---|
| `GET /api/chat/conversations` | staff/support/super_admin | Konuşma listesi (sol liste), son mesaj + unread |
| `GET /api/chat/conversations/:customerId` | staff/support/super_admin | Belirli müşteri konuşması + müşteri özet paneli verisi |
| `GET /api/chat/conversations/:id/messages?before=&limit=` | staff + ilgili müşteri | Sayfalı geçmiş |
| `PATCH /api/chat/conversations/:id/assign` | super_admin | Atama |
| `PATCH /api/chat/conversations/:id/status` | staff/support/super_admin | open/closed |
| `GET /api/portal/chat` | customer | Müşterinin kendi konuşması + geçmiş |
| `POST` mesajlar | (Socket.io üzerinden; REST fallback opsiyonel) | |

### 6.8 Sol Panel — "Müşteri Bilgi Paneli" ve "Bakım Süreçleri"

Sol panelde gösterilecekler (hepsi mevcut veriden türetilebilir):
- **İlişki süresi** — `Customer.createdAt`'ten "X aydır müşterimiz".
- **Plan** — `Customer.plan` (free/starter/premium/vip rozeti).
- **MRR** — `Customer.mrr`.
- **"Bakım süreçleri"** (yorum): bu müşterinin açık `Feedback` talepleri sayısı/listesi + son iletişim tarihi (`Conversation.lastMessageAt`) + basit bir "ilişki sağlığı" göstergesi (örn. açık kritik ticket varsa kırmızı). → **Açık soru: kullanıcı "bakım süreçleri" ile tam olarak neyi kastediyor? Açık ticket'lar mı, bir SLA/sözleşme takibi mi?** (Bölüm 8'de).

### 6.9 Frontend Bileşenleri

İki kolonlu layout (SOL bilgi paneli + SAĞ chat):
- `[NEW]` `frontend/src/pages/ChatDashboard.jsx` (internal) — rota `/chat`. Sol: konuşma listesi + seçili müşteri özet paneli; Sağ: mesaj penceresi. (İç tarafta ayrı sayfa öneriliyor, Customers.jsx'e modal gömmek yerine — daha ölçeklenebilir.)
- `[NEW]` `frontend/src/pages/portal/PortalChat.jsx` — rota `/portal/chat`. Müşteri tek konuşmasını görür; sol panel müşteriye kendi plan/ilişki özetini gösterebilir (opsiyonel) ya da sadeleştirilmiş.
- `[NEW]` Paylaşılan bileşenler: `frontend/src/components/chat/ChatWindow.jsx`, `MessageBubble.jsx`, `MessageInput.jsx`, `ConnectionStatus.jsx` (yeşil/kırmızı nokta), `CustomerInfoPanel.jsx` (sol panel).
- `[NEW]` `frontend/src/context/SocketContext.jsx` — tek Socket.io bağlantısını yönetir (token ile connect, reconnect, event dağıtımı), `AuthProvider` altında.
- `[NEW]` `frontend/src/services/chatService.js` (REST kısmı).
- `[MODIFY]` `frontend/src/App.jsx` — `/chat` (RoleGuard support/staff/super_admin) ve `/portal/chat` route'ları; `SocketProvider` eklenir.
- `[MODIFY]` `frontend/src/config/navigation.js` — internal ve portal navlara "Mesajlar" öğesi (bu yüzden #4 önce yapılmalı).

### 6.10 Backend Dosyaları
- `[NEW]` `backend/models/Conversation.js`, `backend/models/Message.js`
- `[NEW]` `backend/socket/index.js` (io kurulumu), `backend/socket/authMiddleware.js` (JWT handshake), `backend/socket/chatHandlers.js` (event handler'lar)
- `[NEW]` `backend/controllers/chatController.js`, `backend/routes/chatRoutes.js`
- `[MODIFY]` `backend/server.js` (`http.createServer` + `io.attach`; graceful; CSP/CORS'a ws origin)
- `[MODIFY]` `backend/controllers/portalFeedbackController.js` veya yeni `portalChatController.js` + `portalRoutes.js`
- `[MODIFY]` `backend/config/permissions.js` + frontend kopyası (`chat` kaynağı)
- `[MODIFY]` `backend/package.json` → `socket.io`; `frontend/package.json` → `socket.io-client`

---

## 7. Fazlı Uygulama Sırası (Özet)

| Faz | Özellik | Neden bu sırada | Ana çıktı |
|---|---|---|---|
| **0** | #5 Güvenlik (validation + CSP + kilitleme) | Chat'ten önce; tüm write'ları korur | `validators/`, `validate.js`, CSP, kilitleme |
| **1** | #6 Audit Log | #2 ve write'lar buna yazacak | `AuditLog` model, `auditService`, sayfa |
| **2** | #2 Zorunlu şifre değişimi | Küçük; audit'e yazar | `mustChangePassword`, gate, endpoint |
| **3** | #4 Ortak Sidebar | Chat menü öğesi buna eklenecek | `navigation.js`, parametrik Sidebar, portal layout |
| **4** | #1 Harcama dashboard | Bağımsız, paralel yapılabilir | Filtreler, vendor/KDV kırılımı, PDF |
| **5** | #3 Canlı chat | Sidebar + güvenlik + audit üzerine oturur | Socket.io, Conversation/Message, chat UI |

Faz 4 (dashboard) bağımsız olduğu için Faz 1-3 ile paralel ilerletilebilir; ekip tek kişiyse en sona veya araya alınabilir.

---

## 8. Açık Sorular / Netleştirme Noktaları

1. **Chat ↔ Feedback ilişkisi**: Bağımsız `Conversation` öneriyorum. Kullanıcı chat'i mevcut ticket sistemine mi bağlamak istiyor, yoksa ayrı genel iletişim kanalı mı? (Bir mesajdan ticket oluşturma köprüsü istenir mi?)
2. **"Bakım süreçleri" tam tanımı**: Sol panelde ne görünmeli? Sadece açık Feedback'ler mi, yoksa SLA/sözleşme/yenileme tarihi gibi ek "müşteri sağlığı" metrikleri mi? Mevcut modelde SLA/sözleşme alanı YOK — istenirse `Customer`'a yeni alanlar gerekir.
3. **Atama zorunluluğu**: Konuşmaları herkesin (support/staff) görüp cevaplaması mı, yoksa katı sahiplik (yalnız `assignedTo` cevaplayabilir) mi? Yumuşak sahiplik öneriyorum.
4. **Müşteri portal chat kapsamı**: Müşteri sadece kendi tek konuşmasını mı görür (öneri: evet), yoksa ticket başına ayrı chat mi ister?
5. **KDV kırılımı veri konumu**: KDV oranı fatura dokümanında tek alan mı yoksa line-item seviyesinde mi? (Fatura şemasını görmem gerekebilir; kırılım tasarımını etkiler.)
6. **Zorunlu şifre değişimi kapsamı**: Sadece admin-oluşturmalı personel mi, yoksa `grantPortalAccess` ile açılan müşteri portalı da dahil mi? (İkisini de öneriyorum, onay lazım.)
7. **Audit log saklama süresi**: Sınırsız mı, yoksa TTL / arşivleme politikası mı? (Yüksek yazma hacminde koleksiyon büyür.)
8. **PDF export gerçekten isteniyor mu**: Yeni frontend bağımlılığı (`jspdf`) ve Türkçe font gömme maliyeti getirir; CSV yeterli olabilir.

---

### Critical Files for Implementation

- `C:\Users\selam\Desktop\Micro-CRM\backend\server.js` (Socket.io attach, CSP/CORS güncellemesi — chat'in giriş noktası)
- `C:\Users\selam\Desktop\Micro-CRM\backend\config\permissions.js` (yeni `chat` ve `auditLog` kaynakları; tüm yetkilendirmenin tek kaynağı, frontend kopyasıyla senkron)
- `C:\Users\selam\Desktop\Micro-CRM\backend\controllers\authController.js` (kilitleme, `mustChangePassword` claim'i, token üretimi — #2 ve #5 kesişimi)
- `C:\Users\selam\Desktop\Micro-CRM\frontend\src\App.jsx` (yeni route'lar, `PasswordGate`, `SocketProvider` — tüm frontend özelliklerinin bağlanma noktası)
- `C:\Users\selam\Desktop\Micro-CRM\frontend\src\components\layout\Sidebar.jsx` (ortak parametrik Sidebar'a dönüşüm — #4, chat menüsünün önkoşulu)
