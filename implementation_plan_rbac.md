# Micro-CRM — Çok Rollü Yetkilendirme (RBAC) & API Güvenliği Mimari Planı

> Durum: SADECE MİMARİ/PLAN. Bu dokümanda hiçbir kod uygulanmamıştır. Aşağıdaki her şey öneri ve tasarım kararıdır; onayınızdan sonra fazlar halinde uygulanacaktır.

## 0. Yönetici Özeti

Sistem üç bağımsız Node/Express servisinden (ana `backend` :5000, `invoice-ocr-service` :5001, `invoice-ocr-v2` :5002) ve bir React/Vite frontend'inden oluşuyor. Şu anki güvenlik durumu ciddi açıklar içeriyor:

- `backend/models/User.js` → `role` default `'admin'`: register olan herkes admin oluyor, onay akışı yok.
- `backend/middleware/authMiddleware.js` → sadece `protect` var, rol/izin kontrolü (authorize) yok.
- İki fatura servisinde `protect` middleware'i hiç kullanılmıyor → tüm `/api/invoices/*` endpoint'leri halka açık.
- Her üç serviste `cors()` parametresiz (tam açık), helmet yok, rate limiting yok, input validation zayıf.
- JWT payload'ında sadece `{ id }` var; rol claim'i yok (`authController.js` `generateToken`).

Plan bu açıkları kapatmayı ve talep edilen 6 rollü RBAC + müşteri portalı + birleşik harcama dashboard'unu tek tutarlı mimaride sunmayı hedefler.

---

## 1. Rol / İzin Modeli

### 1.1 Roller

İç kullanıcılar (`User` modeli) için önerilen rol enum'u:

| Rol (enum değeri) | Türkçe ad | Kısa tanım |
|---|---|---|
| `super_admin` | Süper Admin | Tam kontrol + kullanıcı onaylama |
| `accountant` | Muhasebeci | Fatura + finansal raporlar |
| `staff` | Çalışan | CRM operasyonları (Customer + Feedback) |
| `support` | Destek | Sadece Customer görüntüleme |
| `intern` | Stajer | Salt-okunur şirket bilgisi |

Ayrıca dış (portal) kullanıcıları için ayrı bir kimlik: `customer` (aşağıda 5. bölümde ayrı bir `CustomerUser` modeli olarak tasarlanıyor — `User` enum'una karıştırılmıyor).

Mevcut `member` rolünün göç (migration) sırasında mantıklı bir role eşlenmesi gerekir (öneri: `staff`). Mevcut `admin` → `super_admin` veya `accountant`; ilk oluşturulan hesap `super_admin`, diğerleri manuel gözden geçirme (bkz. Açık Sorular).

Önerilen ek rol: `manager`/`gözetmen` kullanıcının "gözetmen" ifadesinden geliyor. Şimdilik `super_admin` bunu karşılıyor; ileride onaylama yetkisi olmayan ama her şeyi okuyabilen bir `viewer_manager` rolü eklenebilir. Kapsamı şişirmemek için ilk sürümde 5 iç rol + 1 portal kimliğiyle sınırlı tutulmasını öneriyorum.

### 1.2 İzin Matrisi (Kaynak × Rol)

Kısaltmalar: R=read, W=write (create/update/delete), A=approve, — = erişim yok. "Own" = sadece kendine ait kayıtlar.

| Kaynak / Rol | super_admin | accountant | staff | support | intern | customer (portal) |
|---|---|---|---|---|---|---|
| Users (kullanıcı yönetimi) | R + W + A | — | — | — | — | — |
| User approval (onay) | A | — | — | — | — | — |
| Company/Settings (şirket bilgisi) | R + W | R | R | — | R | — |
| Customers | R + W | R | R + W | R | R | — |
| Feedbacks | R + W | R | R + W | — | R | R (own) + W (own create) |
| Invoices v1 (`invoice-ocr-service`) | R + W | R + W | — | — | — | — |
| Invoices v2 (`invoice-ocr-v2`) | R + W | R + W | — | — | — | — |
| Harcama Dashboard (birleşik toplam) | R | R | — | — | — | — |
| Kendi profili | R + W | R + W | R + W | R + W | R + W | R + W |

Notlar:
- `intern` her yerde salt-okunur; hiçbir yazma yok.
- `support` yalnızca Customer verisini okur; Feedback/Invoice/User görmez.
- `staff` finansal veri (Invoice, revenueImpact raporları) GÖRMEZ — Customer ve Feedback CRUD. (Açık soru: Feedback'teki `revenueImpact` alanı staff'a gösterilsin mi? Bkz. bölüm 12.)
- Bu matris tek bir merkezi yerde (`backend/config/permissions.js` [NEW]) veri olarak tanımlanmalı ki middleware, frontend ve testler aynı kaynağı kullansın.

### 1.3 İzin modeli tercihi: rol-tabanlı vs. yetenek-tabanlı

İki yaklaşım:
- (A) Basit rol kontrolü: `authorize('super_admin','accountant')` — route'a izin verilen rolleri listeler.
- (B) Yetenek (capability) tabanlı: `can('invoice:read')` — roller yeteneklere map'lenir.

Tavsiye: Başlangıçta (A) rol-tabanlı `authorize(...roles)` ile başlayıp, izin matrisini `permissions.js`'te capability tablosu olarak da tutmak (hibrit). Route'larda okunabilirlik için `authorize()` kullanılır; matris tek kaynak olarak dokümante edilir. İleride granülerlik gerekirse capability moduna geçiş kolay olur. Bu, mevcut kod tabanının sadeliğiyle uyumlu.

---

## 2. Veri Modeli Değişiklikleri

### 2.1 `User` şeması genişletme — [MODIFY] `backend/models/User.js`

Eklenecek alanlar (kavramsal):
- `role`: enum'u `['super_admin','accountant','staff','support','intern']` olarak genişlet. **default'u `'admin'`den kaldır** → default `'staff'` (en az ayrıcalıklı makul iç rol) veya default'suz bırakıp create sırasında zorunlu kıl. Bu, "herkes admin oluyor" açığını kapatan kritik değişiklik.
- `status`: enum `['pending','approved','rejected']`, default `'pending'`. Sadece `approved` kullanıcı login sonrası veri görebilir.
- `approvedBy`: `ObjectId → User`, default null (kimin onayladığı).
- `approvedAt`: Date, default null.
- `rejectionReason`: String, opsiyonel.
- (Öneri) `isActive`/`disabledAt`: hesap askıya alma için — süper admin bir kullanıcıyı silmeden devre dışı bırakabilsin.

İlk süper admin sorunu: sistemde hiç kullanıcı yokken ilk kaydı onaylayacak kimse yok. Çözüm önerisi: bir seed script / env-tabanlı bootstrap (`SUPER_ADMIN_EMAIL`) — bu e-postayla oluşan ilk hesap otomatik `super_admin` + `approved`. Bkz. bölüm 11 Faz 1.

### 2.2 Müşteri portalı kimliği — Customer login yaklaşımı

İki seçenek:

**Seçenek A — `Customer` modelini genişletmek** (login alanları ekle: `password`, `hasPortalAccess`, `portalStatus`).
- Artı: tek model, Feedback zaten `customer: ObjectId → Customer`'a bağlı; ekstra join yok.
- Eksi: `Customer` şu an saf CRM verisi (name/email/company/plan/mrr); auth sorumluluğunu buraya yüklemek "tek sorumluluk" ilkesini bozar. Her Customer'ın login'i olması gerekmez (çoğu CRM kaydının parolası boş kalır). Parola hash'i, login rate-limit'i, token iptali gibi güvenlik mantığı CRM veri modeline sızar. `email unique` zaten var ama parola opsiyonel olunca şema kirlenir.

**Seçenek B — Ayrı `CustomerUser` (portal auth) modeli** [NEW] `backend/models/CustomerUser.js`.
- Alanlar: `email` (unique), `password` (hash, select:false), `customer: ObjectId → Customer` (1:1 bağ), `status: ['pending','active','disabled']`, `lastLoginAt`.
- Artı: Auth mantığı CRM verisinden ayrık; portal kullanıcısı silinse bile CRM Customer kaydı kalır; iç `User` ile portal `CustomerUser` net ayrılır (farklı token audience, farklı yetki evreni); güvenlik sertleştirmesi (parola politikası, lockout) sadece burada. Feedback scoping için `CustomerUser.customer` üzerinden Customer'a, oradan `Feedback.customer`'a çözülür.
- Eksi: Ekstra bir model + davet/eşleştirme akışı (bir Customer'a portal erişimi verme adımı).

**Tavsiye: Seçenek B (ayrı `CustomerUser` modeli).** Gerekçe: iç personel yetkisiyle dış müşteri yetkisi tamamen farklı iki güvenlik evreni; bunları tek modelde/token'da karıştırmak ileride yetki sızıntısı riskini artırır. Ayrı model, JWT'de `audience` ayrımı (`aud: 'internal'` vs `aud: 'portal'`) ile birlikte temiz sınır sağlar.

### 2.3 Fatura modelleri (değişiklik gerekmez ama not)

`invoice-ocr-service/models/Invoice.js` → koleksiyon `invoices`; `invoice-ocr-v2/models/Invoice.js` → açıkça `invoicesv2` koleksiyonu. İkisi de `grandTotal`, `totalVat`, `totalBase`, `invoiceDate` içeriyor → birleşik dashboard için uyumlu şema. Değişiklik gerekmiyor; sadece bu servislere auth eklenecek (bkz. bölüm 4). İsteğe bağlı: her iki modele `createdBy: ObjectId` eklenerek "kim yükledi" izlenebilir (audit için önerilir, zorunlu değil).

---

## 3. Onay Akışı (Approval Workflow)

### 3.1 Durum makinesi

```
[register] → pending
pending → approved   (super_admin onayı)
pending → rejected   (super_admin reddi, rejectionReason ile)
approved → disabled  (super_admin askıya alma, opsiyonel)
disabled → approved  (yeniden aktifleştirme)
```

Kurallar:
- `pending` ve `rejected` kullanıcı: login denemesi 403 ("hesabınız onay bekliyor / reddedildi") döner. Login controller status kontrolü yapmalı.
- Onay/red işlemleri idempotent; sadece `super_admin` yapabilir; `approvedBy`/`approvedAt` set edilir.

### 3.2 Kullanıcı yönetimi API'leri — [NEW] `backend/routes/userRoutes.js` + `backend/controllers/userController.js`

Hepsi `protect` + `authorize('super_admin')` altında:

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/api/users` | Tüm kullanıcılar (filtre: `?status=pending`) |
| GET | `/api/users/pending` | Onay bekleyenler (kısayol) |
| GET | `/api/users/:id` | Tek kullanıcı detayı |
| PATCH | `/api/users/:id/approve` | pending→approved, rol atama/doğrulama |
| PATCH | `/api/users/:id/reject` | pending→rejected (+reason) |
| PATCH | `/api/users/:id/role` | Rol değiştirme |
| PATCH | `/api/users/:id/status` | disable/enable |
| DELETE | `/api/users/:id` | Kullanıcı silme (kendini silemez guard'ı) |

### 3.3 Register akışının değişimi — [MODIFY] `backend/controllers/authController.js`

- `register`: kullanıcıyı `status: 'pending'` ve **rol atamadan / güvenli default rolle** oluşturur; **başarılı register token DÖNDÜRMEZ** (şu an dönüyor). Bunun yerine "hesabınız onay bekliyor" mesajı döner. Bu, otomatik-admin açığını kapatır.
- `login`: parola doğru olsa bile `status !== 'approved'` ise 403. Ayrıca token'a rol claim'i eklenir (bkz. 3.4).
- (Öneri) `register` yerine davet-tabanlı akış: süper admin `/api/users/invite` ile e-posta+rol tanımlar, davet edilen kişi parola belirler. Bu daha güvenli; ilk sürümde "açık register ama pending + onay" da kabul edilebilir. Tavsiye: davet-tabanlı (bkz. Açık Sorular).

### 3.4 JWT payload genişletme — [MODIFY] `authController.js` `generateToken`

Şu an: `jwt.sign({ id })`. Öneri: `jwt.sign({ id, role, status, aud: 'internal' })`. Böylece her istekte DB'ye gitmeden hızlı yetki ön-kontrolü mümkün olur. **Ancak** yetki kararı için tek gerçek kaynak DB olmalı (rol değişince eski token'lar geçerli kalır); bu yüzden `protect` yine `User.findById` ile taze `role`/`status` çeker (mevcut davranış korunur), token claim'i sadece servisler-arası hız/portal ayrımı içindir. Token süresi 30 gün çok uzun — rol/onay değişiminde risk; 1-7 gün + refresh düşünülebilir (bkz. Açık Sorular).

---

## 4. Yetkilendirme Middleware Tasarımı

### 4.1 `authorize` middleware — [NEW] `backend/middleware/authorize.js`

Kavramsal tasarım (imza, uygulanış):

```
// authorize(...allowedRoles) → protect'ten SONRA kullanılır, req.user.role'e bakar
authorize('super_admin', 'accountant')

// status guard: protect zaten approved kontrolü yapabilir ya da ayrı requireApproved
```

Davranış:
- `req.user` yoksa 401 (protect atlanmış demektir — dizilim hatası).
- `req.user.status !== 'approved'` ise 403.
- `req.user.role` `allowedRoles` içinde değilse 403.
- Rol listesi yerine capability isteyen varyant: `authorizeCan('invoice:read')` → `permissions.js` matrisine bakar. İkisi de sunulabilir; ilk sürümde `authorize(...roles)` yeterli.

### 4.2 `protect` güncellemesi — [MODIFY] `backend/middleware/authMiddleware.js`

- `select` ile `status` ve `role` alanlarının geldiğinden emin ol (şu an tüm alanlar geliyor, password hariç — sorun yok).
- Opsiyonel: `requireApproved` kontrolünü buraya gömmek yerine ayrı middleware tutmak esneklik sağlar (örn. profil düzenleme pending kullanıcıya açık olsun istenirse).

### 4.3 Route'lara uygulama örnekleri (kavramsal)

- `backend/routes/customerRoutes.js` [MODIFY]:
  - `GET /` → `protect, authorize('super_admin','accountant','staff','support','intern')`
  - `POST/PUT/DELETE` → `protect, authorize('super_admin','staff')`
- `backend/routes/feedbackRoutes.js` [MODIFY]:
  - read → `authorize('super_admin','staff','intern')`
  - write → `authorize('super_admin','staff')`
- `backend/routes/authRoutes.js` [MODIFY]: register'ı davet/pending akışına bağla.

---

## 5. Üç Servisin Tutarlı Auth Stratejisi

### 5.1 Seçenekler

**Seçenek 1 — Paylaşılan JWT secret + her serviste kendi `protect` + `authorize`.**
Her servis aynı `JWT_SECRET` env'ini paylaşır; fatura servisleri gelen Bearer token'ı bağımsız doğrular. Rol claim'i token içinde olduğundan (bkz. 3.4) fatura servisi kullanıcının rolünü token'dan okur; kullanıcı kaydına DB erişimi gerekmez (fatura servislerinin `User` koleksiyonuna erişimi olmayabilir).

**Seçenek 2 — Merkezi API Gateway / auth reverse-proxy.**
Tüm istekler tek gateway'den geçer, gateway auth eder, downstream servislere güvenli header ekler.

### 5.2 Trade-off

| Kriter | Seçenek 1 (paylaşılan secret) | Seçenek 2 (gateway) |
|---|---|---|
| Kurulum eforu | Düşük (mevcut yapıya uyar) | Yüksek (yeni altyapı) |
| İşletme karmaşıklığı | Düşük | Yüksek (ekstra hop) |
| Rol iptali tazeliği | Token süresine bağlı | Merkezi, daha iyi |
| Mevcut kodla uyum | Çok iyi | Zayıf (yeniden yapı) |
| Ölçeklenince | Orta | İyi |

### 5.3 Tavsiye

**Seçenek 1: Paylaşılan `JWT_SECRET` + her serviste kendi hafif `protect`/`authorize` middleware'i.** Bu projenin ölçeği (3 küçük servis, tek geliştirici) için gateway aşırı mühendislik olur. Uygulama:

- Ortak bir doğrulama mantığı, kopya yerine küçük bir paylaşılan modül olarak her serviste tekrarlanır (üç repo/klasör ayrı `node_modules` içerdiğinden gerçek npm paylaşımı zor; pragmatik olarak `invoice-ocr-service/middleware/auth.js` [NEW] ve `invoice-ocr-v2/middleware/auth.js` [NEW] olarak, ana backend'deki mantığın sadeleştirilmiş kopyası — sadece token doğrulama + rol claim kontrolü, DB'siz).
- Fatura route'ları: `protect, authorize('super_admin','accountant')`.
- `JWT_SECRET` üç `.env` dosyasında AYNI olmalı (kritik operasyonel not; dağıtımda tek secret store).
- Token `aud: 'internal'` claim'i fatura servislerinde zorunlu kılınır → portal (`aud:'portal'`) token'ları fatura servislerine giremez.

İleride büyürse Seçenek 2'ye geçiş yolu açık kalır (middleware zaten soyutlanmış olur).

---

## 6. Müşteri Portalı Mimarisi

### 6.1 Kimlik & login

- Model: `CustomerUser` [NEW] (bkz. 2.2 Seçenek B), 1:1 `Customer` bağı.
- Auth controller [NEW] `backend/controllers/portalAuthController.js` veya mevcut auth'a ayrı route grubu:
  - `POST /api/portal/auth/login` → `CustomerUser` doğrular, token `{ id, customerId, aud: 'portal' }`.
  - `POST /api/portal/auth/register` veya davet: süper admin/staff bir Customer'a portal erişimi açar (`POST /api/customers/:id/portal-invite`) — Customer'ın kendi kendine kayıt olmasına izin verilip verilmeyeceği açık soru.
  - `GET /api/portal/auth/me`.
- Ayrı `protectPortal` middleware [NEW] `backend/middleware/portalAuth.js`: token'ı doğrular, `aud === 'portal'` kontrol eder, `req.customerUser` + `req.customerId` set eder. İç `protect` ile karışmaz.

### 6.2 Veri scope'lama (query filtreleme)

- Portal endpoint'leri: `GET /api/portal/feedbacks` → controller **her zaman** `Feedback.find({ customer: req.customerId })` uygular. `customerId` token'dan gelir, istekten (body/query) ASLA alınmaz → IDOR (yetkisiz kayıt erişimi) engellenir.
- `POST /api/portal/feedbacks` → yeni feedback'te `customer` alanı zorla `req.customerId`'ye set edilir; istemcinin gönderdiği `customer` yok sayılır.
- `GET /api/portal/feedbacks/:id` → önce id ile bul, sonra `feedback.customer.equals(req.customerId)` doğrula; değilse 404 (403 yerine 404 vererek varlık sızıntısını engelle).
- Portal, Invoice/User/diğer Customer verilerine ERİŞEMEZ (ayrı route ağacı `/api/portal/*`, sadece portal-scoped controller'lar).

### 6.3 Frontend portal

- Ayrı bir React alanı: ya aynı SPA içinde `/portal/*` route grubu + ayrı `PortalAuthContext`, ya da ayrı bir mini uygulama. Tavsiye: ilk sürümde aynı SPA içinde `/portal/login`, `/portal/feedbacks` route'ları + ayrı context ve ayrı token anahtarı (`micro-crm-portal-token`) — iç token ile karışmaması için farklı localStorage anahtarı.

---

## 7. Birleşik Harcama (Genel Toplam) Dashboard'u

### 7.1 Veri kaynağı

İki ayrı servis, iki ayrı koleksiyon (`invoices`, `invoicesv2`), her ikisinde `grandTotal`, `totalVat`, `totalBase`, `invoiceDate`. Toplanacak metrikler: toplam harcama (`sum(grandTotal)`), toplam KDV (`sum(totalVat)`), dönemsel (aylık) kırılım, servis bazlı kırılım (v1 vs v2), fatura sayısı.

### 7.2 Seçenekler

**(a) Frontend'de birleştirme:** Frontend her iki servise ayrı çağrı yapar, tarayıcıda toplar.
- Eksi: iki servise de doğrudan erişim + CORS + iş mantığı frontend'e sızar; tutarsızlık riski.

**(b) Ana backend'de birleştirici endpoint (BFF/aggregator):** [NEW] `GET /api/reports/spending-summary` ana backend'de, `protect, authorize('super_admin','accountant')`. Bu endpoint her iki fatura servisine sunucu-taraflı HTTP çağrısı yapıp (kendi servis-token'ıyla) sonuçları birleştirir.
- Her fatura servisinde hafif bir aggregate endpoint [NEW]: `GET /api/invoices/summary?from=&to=` → Mongo `$group` ile `sum(grandTotal)`, `sum(totalVat)`, aylık kırılım döner. Bu, tüm faturaları çekip frontend'de toplamaktan çok daha verimli.
- Ana backend `axios`/`node-fetch` ile iki summary'yi çağırır, servisler-arası JWT (`aud:'internal'`, `service` claim'li) ile yetkilenir, birleştirip döner. Kısmi hata toleransı: bir servis düşükse `partial: true` bayrağıyla eldeki veriyi döndür.

**(c) Ortak DB view / doğrudan koleksiyon erişimi:** Ana backend her iki koleksiyona doğrudan Mongoose modeliyle erişip aggregate eder.
- Not: Üç servis aynı MongoDB cluster'ını kullanıyorsa (env `MONGO_URI` paylaşımı muhtemel), ana backend `invoicesv2` ve `invoices` koleksiyonlarına salt-okunur model tanımıyla doğrudan `$group` çalıştırabilir. En performanslı ve en az servisler-arası bağımlılık; ancak koleksiyon şemasına bağımlılık (coupling) yaratır.

### 7.3 Tavsiye

**(b) ana backend aggregator endpoint + her fatura servisinde `$group` tabanlı summary endpoint.** Gerekçe: servis sınırlarına saygı gösterir, frontend'i basit tutar (tek çağrı), her servis kendi verisinin "doğruluk kaynağı" olur. Eğer üç servis kesinlikle aynı DB'yi paylaşıyorsa ve düşük gecikme kritikse, (c) pragmatik bir kısayol olarak kabul edilebilir — bunu netleştirmek için Açık Soru olarak işaretledim (paylaşılan DB mi?). Senkron çağrı yeterli (rapor gerçek-zamanlı olmak zorunda değil); ileride ağırlaşırsa kısa süreli cache (ör. 60 sn) eklenebilir.

Frontend: [NEW] `frontend/src/pages/SpendingDashboard.jsx` — sadece `super_admin`/`accountant` menüsünde görünür.

---

## 8. API Güvenliği Sertleştirme Listesi

Her üç servise (backend, invoice-ocr-service, invoice-ocr-v2) uygulanacak:

| # | Önlem | Paket / Yaklaşım | Uygulanacak yer |
|---|---|---|---|
| 1 | Güvenlik başlıkları | `helmet` | Üç `server.js` [MODIFY] |
| 2 | CORS kısıtlama | `cors({ origin: [FRONTEND_URL], credentials })` — parametresiz `cors()` kaldır | Üç `server.js` [MODIFY] |
| 3 | Rate limiting | `express-rate-limit` — global + login/register için sıkı ayrı limiter | Üç `server.js`; auth route'larda ekstra |
| 4 | Brute-force yavaşlatma | `express-slow-down` (opsiyonel, login) | `authRoutes` |
| 5 | Input validation | `express-validator` veya `zod`/`joi` — register/login/customer/feedback body şemaları | Route/controller katmanı |
| 6 | NoSQL injection temizliği | `express-mongo-sanitize` | Üç `server.js` |
| 7 | HTTP param pollution | `hpp` | Üç `server.js` |
| 8 | Body boyut limiti | `express.json({ limit: '1mb' })` | Üç `server.js` |
| 9 | Register kapatma/pending | Davet-tabanlı akış + pending default (bkz. 3.3) | `authController` [MODIFY] |
| 10 | JWT sertleştirme | Kısa TTL + `aud` claim + güçlü secret (min 32 byte) doğrulaması; secret yoksa boot'ta hata | `authController`, `protect` |
| 11 | Fatura servislerine auth | `protect`+`authorize` (bkz. bölüm 5) | İki fatura servisi [MODIFY] |
| 12 | Parola politikası | minlength artır (6→8+), zayıf parola reddi | `User`/`CustomerUser` şema + validation |
| 13 | Upload güvenliği | Fatura servisi `upload.js` — mime/size zaten var; ek olarak dosya adı sanitize, magic-byte kontrol | `middleware/upload.js` [MODIFY] |
| 14 | Statik dosya erişimi | `invoice-ocr-service` `/uploads` şu an halka açık statik → auth arkasına al veya imzalı URL | `invoice-ocr-service/server.js` [MODIFY] |
| 15 | Merkezi hata maskeleme | Prod'da stack trace sızdırma | `errorHandler` gözden geçir |
| 16 | Secret yönetimi | `.env.example` güncelle, `JWT_SECRET` üç serviste ortak | `.env` dosyaları |
| 17 | Audit log (öneri) | Onay/rol değişimi/login için minimal log koleksiyonu | opsiyonel [NEW] |

---

## 9. Frontend Rol-Bazlı Routing & Menü

### 9.1 AuthContext genişletme — [MODIFY] `frontend/src/context/AuthContext.jsx`

- `user` objesi zaten `role` içeriyor (login response `role` döndürüyor). Ekle: `status`, ve türetilmiş `hasRole(...)`, `can(resource, action)` yardımcıları (izin matrisinin frontend kopyası [NEW] `frontend/src/config/permissions.js`).
- `register` sonrası artık token gelmeyecek (pending) → register akışı "onay bekleniyor" ekranına yönlendirmeli.

### 9.2 RoleGuard / PermissionGate bileşeni — [NEW] `frontend/src/components/auth/RoleGuard.jsx`

- Route-seviyesi: `<RoleGuard allow={['super_admin','accountant']}>` — izinli değilse `/` veya "yetkiniz yok" sayfasına yönlendir.
- Eleman-seviyesi: `<PermissionGate can="customer:write">...</PermissionGate>` — buton/aksiyon gizleme.
- **Önemli:** Frontend guard'ı sadece UX içindir; gerçek yetki her zaman backend'de zorlanır (frontend kontrolü güvenlik sınırı değildir).

### 9.3 App.jsx routing — [MODIFY] `frontend/src/App.jsx`

- Mevcut `ProtectedRoute`'a rol parametresi eklenir veya `RoleGuard` ile sarılır.
- Yeni route'lar: `/users` (super_admin), `/reports/spending` (super_admin, accountant), `/portal/*` (portal context).
- Rol bazlı landing: login sonrası role göre farklı ana sayfa (support → `/customers`, accountant → `/invoices` veya spending).

### 9.4 Sidebar filtreleme — [MODIFY] `frontend/src/components/layout/Sidebar.jsx`

- Her menü öğesine `roles: [...]` alanı ekle; render sırasında `user.role`'e göre filtrele.
- Örnek görünürlük:
  - Dashboard: tüm iç roller.
  - Customers: super_admin, staff, support, intern (read), accountant.
  - Feedbacks: super_admin, staff, intern.
  - Invoices / Invoices v2: super_admin, accountant.
  - Spending: super_admin, accountant.
  - Users (Kullanıcı Yönetimi): super_admin.
- `financeItems` grubu accountant/super_admin dışına gizlenir.

### 9.5 Yeni sayfalar

- [NEW] `frontend/src/pages/UserManagement.jsx` — pending liste + approve/reject + rol atama (super_admin).
- [NEW] `frontend/src/pages/SpendingDashboard.jsx` — birleşik harcama.
- [NEW] `frontend/src/pages/PendingApproval.jsx` — register sonrası onay bekleme ekranı.
- [NEW] Portal sayfaları: `frontend/src/pages/portal/PortalLogin.jsx`, `PortalFeedbacks.jsx`.

---

## 10. Dokunulacak / Oluşturulacak Dosyalar

### Backend (ana, :5000)
- [MODIFY] `backend/models/User.js` — rol enum genişletme, default kaldırma, status/approvedBy/approvedAt.
- [NEW] `backend/models/CustomerUser.js` — portal auth kimliği.
- [NEW] `backend/config/permissions.js` — izin matrisi (tek kaynak).
- [MODIFY] `backend/middleware/authMiddleware.js` — protect + requireApproved.
- [NEW] `backend/middleware/authorize.js` — `authorize(...roles)` / `authorizeCan`.
- [NEW] `backend/middleware/portalAuth.js` — `protectPortal`.
- [NEW] `backend/middleware/security.js` — helmet/cors/rate-limit/sanitize kurulumları (opsiyonel toplama).
- [MODIFY] `backend/controllers/authController.js` — register pending, login status guard, JWT claim'leri.
- [NEW] `backend/controllers/userController.js` — kullanıcı yönetimi + onay.
- [NEW] `backend/controllers/portalAuthController.js` — portal login/register/me.
- [NEW] `backend/controllers/portalFeedbackController.js` — scope'lu feedback.
- [NEW] `backend/controllers/reportController.js` — birleşik harcama aggregator.
- [NEW] `backend/routes/userRoutes.js`
- [NEW] `backend/routes/portalRoutes.js`
- [NEW] `backend/routes/reportRoutes.js`
- [MODIFY] `backend/routes/authRoutes.js`, `customerRoutes.js`, `feedbackRoutes.js` — authorize ekleme.
- [MODIFY] `backend/server.js` — güvenlik middleware'leri, yeni route'lar (`/api/users`, `/api/portal`, `/api/reports`).
- [NEW] `backend/scripts/seedSuperAdmin.js` — ilk süper admin bootstrap.
- [MODIFY] `backend/.env` / `.env.example` — `JWT_SECRET`, `FRONTEND_URL`, `SUPER_ADMIN_EMAIL`, servis URL'leri.

### invoice-ocr-service (:5001)
- [NEW] `invoice-ocr-service/middleware/auth.js` — protect+authorize (DB'siz, token claim tabanlı).
- [NEW] `invoice-ocr-service/controllers|routes` summary endpoint (`/api/invoices/summary`).
- [MODIFY] `invoice-ocr-service/routes/invoiceRoutes.js` — auth uygula.
- [MODIFY] `invoice-ocr-service/server.js` — helmet/cors/rate-limit; `/uploads` korunması.
- [MODIFY] `invoice-ocr-service/.env` — ortak `JWT_SECRET`, `FRONTEND_URL`.

### invoice-ocr-v2 (:5002)
- [NEW] `invoice-ocr-v2/middleware/auth.js`
- [MODIFY] `invoice-ocr-v2/routes/invoiceRoutes.js` — auth + summary endpoint.
- [MODIFY] `invoice-ocr-v2/server.js` — güvenlik middleware.
- [MODIFY] `invoice-ocr-v2/config/index.js` + `.env` — `jwtSecret`, `frontendUrl`.

### Frontend
- [MODIFY] `frontend/src/App.jsx` — RoleGuard, yeni route'lar, portal.
- [MODIFY] `frontend/src/context/AuthContext.jsx` — status/hasRole/can, register akışı.
- [NEW] `frontend/src/context/PortalAuthContext.jsx`
- [MODIFY] `frontend/src/components/layout/Sidebar.jsx` — rol filtreli menü.
- [NEW] `frontend/src/components/auth/RoleGuard.jsx` + `PermissionGate.jsx`
- [NEW] `frontend/src/config/permissions.js`
- [NEW] `frontend/src/pages/UserManagement.jsx`, `SpendingDashboard.jsx`, `PendingApproval.jsx`
- [NEW] `frontend/src/pages/portal/PortalLogin.jsx`, `PortalFeedbacks.jsx`
- [MODIFY] `frontend/src/services/api.js` — portal token için ayrı instance / interceptor (varsa).

---

## 11. Önerilen Uygulama Sırası (Fazlar)

**Faz 0 — Hazırlık & güvenlik acil durumu (hızlı kazanımlar)**
- Üç serviste helmet + CORS kısıtlama + rate-limit + body limit.
- `User` default rolü `'admin'`den çıkar (kritik açık). `.env` `JWT_SECRET` senkronu.
- Bu faz tek başına en büyük riskleri düşürür.

**Faz 1 — RBAC çekirdeği (ana backend)**
- `User` şema genişletme (status/role/approvedBy) + göç script'i + süper admin seed.
- `authorize` middleware + `permissions.js`.
- `authController` register→pending, login status guard, JWT claim.
- Kullanıcı yönetimi + onay API'leri (`userController`/`userRoutes`).
- Customer/Feedback route'larına authorize uygulama.

**Faz 2 — Fatura servisleri auth entegrasyonu**
- İki fatura servisine `auth.js` middleware + route koruması.
- `/uploads` erişim koruması.
- Servisler-arası token stratejisinin doğrulanması.

**Faz 3 — Müşteri portalı**
- `CustomerUser` modeli + `protectPortal` + portal auth/feedback controller & routes.
- Customer'a portal erişimi verme akışı.
- Frontend portal alanı.

**Faz 4 — Birleşik harcama dashboard'u**
- Fatura servislerinde summary (`$group`) endpoint'leri.
- Ana backend aggregator (`reportController`).
- Frontend SpendingDashboard.

**Faz 5 — Frontend RBAC & cila**
- RoleGuard/PermissionGate, Sidebar filtreleme, rol-bazlı landing, UserManagement UI, PendingApproval ekranı.
- Input validation'ın tüm yazma endpoint'lerine yayılması, audit log (opsiyonel).

Not: Faz 0 ilk yapılmalı (bağımsız ve yüksek etkili). Faz 1 diğer her şeyin temeli. Faz 3 ve Faz 4 birbirinden bağımsız, paralel ilerleyebilir.

---

## 12. Açık Sorular / Netleştirme Noktaları

1. **"Çalışan (staff)" kapsamı:** Varsayım = Customer (CRUD) + Feedback (CRUD), finansal veri yok. Feedback'teki `revenueImpact` (finansal alan) staff'a gösterilsin mi, yoksa maskelensin mi?
2. **"Gözetmen" ayrı bir rol mü?** Süper Admin bunu karşılıyor kabul edildi. Onaylama yetkisi olmayan ama tümünü okuyan ayrı bir `manager` rolü ister misiniz?
3. **Register modeli:** Açık self-register (pending + onay) mı, yoksa tamamen davet-tabanlı (sadece süper admin kullanıcı ekler) mi tercih edersiniz? Güvenlik için davet-tabanlı öneriliyor.
4. **Müşteri portalı kayıt:** Müşteriler kendileri mi kayıt olacak, yoksa personel mi bir Customer'a portal erişimi açacak?
5. **Paylaşılan MongoDB:** Üç servis aynı MongoDB cluster/veritabanını mı kullanıyor? (Evet — hepsi aynı `microcrm` veritabanını, farklı koleksiyonlarla kullanıyor, bunu biliyoruz.) Bu, harcama dashboard'u için (b) mi yoksa (c) doğrudan koleksiyon erişimi mi tercih edileceğini belirler.
6. **JWT ömrü / refresh:** Mevcut 30 gün. Rol/onay değişiminde eski token'ların geçerli kalması riskli. Kısa TTL + refresh token ister misiniz?
7. **Mevcut veri göçü:** Hâlihazırda `admin`/`member` rolüyle ve muhtemelen onaysız kayıtlı kullanıcılar var. Bunlar toplu `approved` sayılıp rolleri map'lensin mi (member→staff, admin→?), yoksa hepsi pending'e mi düşsün?
8. **Süper admin bootstrap:** İlk süper admin env `SUPER_ADMIN_EMAIL` + seed script ile mi, yoksa mevcut bir kullanıcıyı manuel yükseltme ile mi belirlensin?

---

## 13. Kapsam Dışı Not

Kullanıcının "Bunu ben neden almalıyım sorusu" notu teknik bir gereksinim değildir; ürünün değer önerisi/pazarlama konusudur ve bu mimari planın kapsamı dışındadır — burada ele alınmamıştır.
