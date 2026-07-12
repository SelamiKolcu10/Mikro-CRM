# Intern Rolü — Genişletilmiş Salt-Okunur Erişim — Tasarım

Tarih: 2026-07-12
Durum: Onaylandı (kullanıcı ile karşılıklı netleştirme sonrası)

## Amaç

`intern` rolü şu an sadece `company`, `customers`, `feedbacks`, `tasks` kaynaklarını okuyabiliyor.
Bu tasarım, intern'ların **Faturalar hariç sistemdeki tüm panelleri okuyabilmesini**, hiçbir
yazma/aksiyon yapamamasını, ve kullanıcıyla ilgili panellerde e-posta adreslerinin maskelenmesini
sağlar. İstisna: kendilerine atanan görevlerde (Task modülü) durum değiştirebilirler — bu zaten
mevcut `taskScope`/`canActOnTask` mantığıyla çözülüyor, ayrıca bir kural gerekmiyor.

## 1) Kapsam — Panel Bazlı Karar Tablosu

| Panel | Intern erişimi | Not |
|---|---|---|
| Müşteriler (customers) | Okuma (mevcut) | Değişiklik yok |
| Geri Bildirimler (feedbacks) | Okuma (mevcut) | Değişiklik yok |
| Görevler (tasks) | Okuma: **tüm departmanlar**; Aksiyon: sadece kendine atanan görevde | `taskScope` içinde yeni intern dalı |
| Canlı Sohbet (chat) | Okuma: **yeni**; Yazma: yok | Mesaj kutusu gizlenir |
| Kullanıcı Yönetimi (users) | Okuma: **yeni** (e-posta maskeli) | Aksiyon butonları gizlenir |
| Denetim Kaydı (auditLog) | Okuma: **yeni** (aktör e-postası maskeli) | Zaten aksiyon içermiyor |
| Onaylar (approvals) | Okuma: **yeni** (e-posta maskeli) | Onayla/reddet butonları gizlenir |
| Erişim Kontrol Matrisi (permission-overrides) | Okuma: **yeni** (e-posta maskeli) | Yetki ver/geri al butonları gizlenir |
| Genel Harcama (spendingReport) | Okuma: **yeni** | Zaten aksiyon içermiyor |
| Faturalar (invoices, invoices-v2) | **Hiç erişim yok** | Değişiklik yok — zaten kapsam dışı, dokunulmuyor |

## 2) Backend — İzin Matrisi (`backend/config/permissions.js`)

`PERMISSIONS` tablosuna eklenecek `read: [..., ROLES.INTERN]` girdileri: `users`, `auditLog`,
`approvals` (mevcut aksiyon adı `review`, `write` değil — bkz. Bölüm 7), `spendingReport`, `chat`.
`invoices` girdisine **dokunulmuyor**.

**Yeni kaynak:** `permissionOverrides: { read: [SUPER_ADMIN, INTERN], write: [SUPER_ADMIN] }`.
Şu an Access Control Matrix'in kendi yetkilendirmesi `PERMISSIONS` matrisinden değil, doğrudan
`permissionOverrideRoutes.js`'teki sabit `authorize(ROLES.SUPER_ADMIN)` çağrısından geliyor —
matriste hiç karşılığı yok. Intern'a okuma açılınca bu tutarsız kalır, o yüzden diğer her
kaynakla aynı deseni takip etmesi için matrise ekleniyor (bkz. Bölüm 3 ve 7).

Frontend'deki `frontend/src/config/permissions.js` birebir aynalanır (yeni `permissionOverrides`
girdisi dahil).

## 3) Backend — Route Yetkilendirmesi (4 dosya, blanket authorize'ı GET/mutasyon olarak ayırma)

Şu an `userRoutes.js` ve `auditRoutes.js` ve `permissionOverrideRoutes.js`, `router.use(protect,
authorize('super_admin'))` ile **tüm** route'ları tek seferde kilitliyor (GET dahil).
`approvalRoutes.js` zaten route-bazlı `authorize()` kullanıyor (değişikliği en az bu dosyada).

Her dosyada **okuma route'ları** `authorize(ROLES.SUPER_ADMIN, ROLES.INTERN)`,
**yazma/silme route'ları** `authorize(ROLES.SUPER_ADMIN)` olacak şekilde ayrılacak:

- `userRoutes.js`: `GET /`, `GET /pending`, `GET /:id` → +INTERN. `POST /`, `PATCH .../approve`,
  `PATCH .../reject`, `PATCH .../role`, `PATCH .../department`, `DELETE /:id` → değişmez.
- `auditRoutes.js`: `GET /`, `GET /:id` → +INTERN (tek değişiklik, dosyada başka route yok).
- `approvalRoutes.js`: `GET /` (tam kuyruk) → `authorize(...PERMISSIONS.approvals.read)` (+INTERN).
  `GET /mine` zaten herkese açık, dokunulmuyor. `PATCH .../approve`, `PATCH .../reject` →
  `authorize(...PERMISSIONS.approvals.review)`, değişmez (hâlâ sadece SUPER_ADMIN).
- `permissionOverrideRoutes.js`: `router.use(protect, authorize(ROLES.SUPER_ADMIN))` kaldırılır;
  `GET /` → `authorize(...PERMISSIONS.permissionOverrides.read)` (+INTERN), `POST /` ve
  `DELETE /:id` → `authorize(...PERMISSIONS.permissionOverrides.write)` (değişmez, sadece
  SUPER_ADMIN — dosyadaki "no exceptions" yorumu sadece **yazma** için geçerli kalıyor).

## 4) Backend — E-posta Maskeleme (`backend/utils/redactPII.js`, yeni dosya)

Maskeleme **backend'de** yapılmalı — sadece frontend'de gizlemek gerçek e-postanın API
yanıtında düz metin gitmesine ve DevTools/Network sekmesinden okunabilmesine engel olmaz.

Tek bir paylaşılan fonksiyon: `redactEmails(data)` — cevabı (iç içe/populate edilmiş nesneler
dahil) derinlemesine gezip her `email` ve `actorEmail` anahtarının değerini `'******'` ile
değiştirir. Mongoose belgelerini önce `JSON.parse(JSON.stringify(data))` ile düz nesneye çevirip
öyle gezer (Mongoose'un iç yapısına takılmamak için).

Bunu her controller'a tek tek yazmak yerine, tek bir middleware — `backend/middleware/
redactForIntern.js` — ilgili 4 route dosyasına eklenir: `req.user.role !== 'intern'` ise hiçbir
şey yapmadan `next()` çağırır; `intern` ise `res.json`'u sarıp gönderilecek `{ success, data }`
gövdesindeki `data` alanını `redactEmails` ile işleyip öyle gönderir. Yeni bir alan eklendiğinde
bile (örn. ileride bir endpoint'e yeni bir `email` alanı eklenirse) otomatik çalışır.

**Maskelenen alanlar:** sadece `email`/`actorEmail`. İsim, rol, departman, durum gibi alanlar
**değişmeden** görünür (kullanıcının kim olduğu anlaşılsın diye — sadece iletişim bilgisi gizli).

## 5) Backend — Task Görünürlüğü (`backend/utils/taskScope.js`)

`taskScope(user)` fonksiyonuna yeni bir dal: `role === ROLES.INTERN` ise `{}` döner (super_admin
gibi tüm departmanları okur). `canApproveTask`/`canActOnTask` **hiç değişmiyor** — bunlar zaten
"sadece kendine atanan görevde işlem yapabilir, lider değilse onaylayamaz" kuralını doğru
uyguluyor. Frontend `frontend/src/utils/taskScope.js`'e dokunulmuyor (aynı mantığı zaten
kullanıyor, sadece backend'in okuma kapsamı genişliyor).

## 6) Frontend — Navigasyon ve Route Guard

`frontend/src/config/navigation.js`: `nav.users`, `nav.auditLog`, `nav.approvals`,
`nav.accessControl`, `nav.chat`, `nav.spendingReport` öğelerinin `roles` listelerine `ROLES.INTERN`
eklenir. `frontend/src/App.jsx`: aynı 6 route'un `RoleGuard allow` listelerine `ROLES.INTERN`
eklenir. `nav.tasks` zaten önceki bölümde eklenmişti.

## 7) Frontend — 4 Sayfa Salt-Okunur Moda Alınıyor

`UserManagement.jsx`, `PendingApprovals.jsx`, `AccessControlMatrix.jsx` şu an hiç `PermissionGate`
kullanmıyor (sayfanın tamamı zaten sadece super_admin'e açıktı, ihtiyaç yoktu) — bu üç sayfada
**yeni** olarak, her mutasyon tetikleyen kontrol `PermissionGate` ile sarılır:

- `UserManagement.jsx`: "Yeni Kullanıcı Ekle" butonu ve sil butonu → `resource="users" action="write"`;
  onayla/reddet butonları → `resource="users" action="approve"`; rol/departman `<select>`'leri ve
  lider checkbox'ı → `resource="users" action="write"`.
- `PendingApprovals.jsx`: onayla/reddet butonları → `resource="approvals" action="review"`.
- `AccessControlMatrix.jsx`: "Yetki Ver" formu/butonu ve geri al butonu →
  `resource="permissionOverrides" action="write"`.

Bu üç kaynak için `write`/`approve`/`review` action'ları intern'a hiç eklenmediğinden `can()`
otomatik `false` döner, kontroller görünmez. `AuditLog.jsx` zaten aksiyon içermiyor, değişiklik
gerekmez.

`ChatDashboard.jsx`: `MessageInput` bileşeni `<PermissionGate resource="chat" action="write">`
içine alınır (satır 348 civarı, şu an hiçbir izin kontrolüne sarılı değil).

## Kapsam Dışı (bu tasarımda yok)

- Faturalar (`invoices`, `invoices-v2`) — hiç dokunulmuyor, intern için tamamen kapalı kalıyor.
- İsim maskeleme — sadece e-posta maskeleniyor, isim/rol/departman/durum görünür kalıyor.
- PermissionOverride (Access Control Matrix) sisteminin kendi işleyişi — zaten role bakmaksızın
  çalışıyor (`authorizeOrQueue.js`, kullanıcı ID'sine göre), hiçbir kod değişikliği gerekmiyor.
- Departman CRUD, task transfer, çoklu assignee — önceki task-management tasarımında zaten
  kapsam dışıydı, bu tasarım da onu değiştirmiyor.
