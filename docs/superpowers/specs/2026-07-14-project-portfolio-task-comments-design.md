# Project Portfolio & Task Comments — Tasarım

Tarih: 2026-07-14 | Durum: Onay bekliyor

## Amaç

İki özellik: (1) **Proje Portföyü** — projeleri (isim, tech stack, mimari notlar/wiki, ekip) kart
grid'i + sağdan açılan detay drawer'ı ile yöneten, sadece super_admin ve Dev Lead'in erişebildiği
yeni bir sayfa; (2) **Görev Yorumları** — mevcut `TaskDetailModal` içine kronolojik yorum akışı.
Mevcut mimari desenler (service+hook ayrımı, çift dosyalı izin matrisi, scope util'leri, i18n)
birebir korunur.

> Not: Orijinal spec Tailwind varsayıyor — bu projede Tailwind yok; tüm stil `index.css`'teki
> token sistemiyle (plain CSS) yazılacak. Spec'in düzelttiğimiz diğer noktaları ilgili bölümlerde.

## 1) Yeni Backend Modeli: `Project`

`backend/models/Project.js` (yeni):
```
name: String, required, unique, trim, maxlength 100
techStack: [String] (trim'li, boş string'ler filtrelenir)
architectureNotes: String, default '' (Markdown kaynak metni, maxlength ~20000)
teamMembers: [ObjectId ref 'User']
timestamps: true
```

**`progress` alanı DB'ye YAZILMAZ** (spec'ten sapma): tamamlanma yüzdesi her okunuşta
`Task` üzerinden hesaplanır (`done / toplam`, projectId'ye bağlı görevler). Saklanan alan her görev
durum değişikliğinde/silinişinde senkron tutulmak zorunda kalır — denormalizasyon hatası riski,
bu veri hacminde kazancı yok. `getProjects` tek bir aggregation ile (`$group` by `projectId`)
tüm projelerin sayaçlarını bir sorguda alır, yanıtına `progress`, `taskCount`, `doneCount` ekler.

## 2) `Task` Modeli Değişiklikleri

`backend/models/Task.js`'e iki ek (mevcut alanlara dokunulmaz, `department` **immutable kalır**):

```
projectId: ObjectId ref 'Project', default null   // opsiyonel bağ
comments: [{
  user: ObjectId ref 'User', required
  text: String, required, trim, maxlength 1000
  createdAt: Date, default Date.now
}]
```

**Karar — departman ve proje bağımsız eksenlerdir:** bir projenin görevleri birden çok
departmana yayılabilir (örn. development projesinde design görevi). `projectId` hiçbir
yetki/görünürlük kararına girmez; görev görünürlüğü aynen `taskScope` ile kalır. Proje sadece
gruplama/raporlama eksenidir. `teamMembers` da görev atamasını kısıtlamaz (v1'de yalnızca vitrin).

`createTask` opsiyonel `projectId` kabul eder (validator: geçerli ObjectId + var olan proje).
Görev formunda proje seçici yalnızca `canManageProjects` olan kullanıcıya gösterilir (proje
listesini zaten sadece onlar okuyabilir).

## 3) RBAC: `projects` Kaynağı + `projectScope`

Kural: sadece `super_admin` VEYA Dev Lead (`isDepartmentLead && department === 'development'`)
tüm CRUD'a erişir. Dev Lead koşulu düz rol dizisiyle ifade edilemez — tasks modülündeki çözümün
aynısı uygulanır: **route'ta kaba rol filtresi + util'de ince kural**.

- `backend/config/permissions.js` + `frontend/src/config/permissions.js` (senkron kopya):
```
projects: {
  read: [ROLES.SUPER_ADMIN, ROLES.STAFF],   // kaba filtre — asıl kural projectScope.js'te
  write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
}
```
  (tasks'taki gibi açıklayıcı yorum satırı eklenir: dev-lead kontrolü util'de.)

- `backend/utils/projectScope.js` (yeni, saf fonksiyon):
```
canManageProjects(user) =>
  user.role === ROLES.SUPER_ADMIN ||
  (user.isDepartmentLead && user.department === 'development')
```

- `backend/routes/projectRoutes.js` (yeni): `router.use(protect, authorize(...PERMISSIONS.projects.read),
  requireProjectManager)` — `requireProjectManager` küçük bir inline middleware,
  `canManageProjects(user)` false ise **403** döner. Böylece dev-lead olmayan staff kaba filtreyi
  geçse bile middleware katmanında bloklanır (spec'in "API shielding" isteği).

- Frontend aynası: `frontend/src/utils/projectScope.js` — aynı `canManageProjects`, sidebar ve
  route guard'da kullanılır (UX-only; asıl kural backend'de).

Endpoint'ler: `GET /api/projects` (progress + teamMembers populate: name/role),
`POST /api/projects`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`,
`GET /api/projects/:id/tasks` (drawer'daki görev akışı — assignedTo populate, statüye göre
gruplama client'ta). Controller: `backend/controllers/projectController.js`, validator:
`backend/validators/projectValidators.js`.

## 4) Yorum API'si

- `GET /api/tasks/:id/comments` — yorumlar `user` populate (name, role) ile döner. Board'un
  liste yanıtına gömülmez (payload şişirmemek için); modal açılınca lazy çekilir.
- `POST /api/tasks/:id/comments` — `{ text }` alır, ekler, eklenen yorumu populate ederek döner.

Yetki: görevi `taskScope(user)` filtresiyle görebilen herkes yorumları okur; yorum **yazma**
intern'e kapalıdır (uygulama genelindeki read-only intern kuralıyla tutarlı). Kontrol
`taskController` içinde: `Task.findOne({ _id, ...taskScope(user) })` + intern engeli. Yorum
düzenleme/silme yok (bkz. Kapsam Dışı) — bu yüzden ayrı yetki matrisi girdisi gerekmez.

## 5) Sidebar & Route Kablolaması

`navigation.js`'teki `roles` dizisi de Dev Lead'i ifade edemez → **en küçük genişletme**:
nav item'a opsiyonel `visible(user)` predicate'i eklenir, olmayan item'lar için davranış
değişmez.

- `frontend/src/config/navigation.js` — `admin` section'ının `items` dizisinde `/users`
  girdisinin **hemen üstüne**:
```
{ path: '/projects', icon: HiOutlineFolderOpen, labelKey: 'nav.projects',
  roles: [ROLES.SUPER_ADMIN, ROLES.STAFF], visible: canManageProjects },
```
- `Sidebar.jsx` filtre satırı (tek satır diff):
```
items: group.items.filter((item) =>
  item.visible ? isInternal && item.visible(user)
               : !item.roles || (isInternal && item.roles.includes(user.role)))
```
- `App.jsx`: `/projects` route'u `RoleGuard allow={[SUPER_ADMIN, STAFF]}` + sayfa içinde
  `canManageProjects(user)` değilse `/`'a redirect (backend'deki kaba+ince desenle aynı).

## 6) Projects Sayfası: Grid + Drawer (Frontend Veri Akışı)

Service+hook ayrımı (mobil port kuralı — fetch component'e girmez):

- `frontend/src/services/projectService.js` — 5 endpoint çağrısı.
- `frontend/src/hooks/useProjects.js` — liste + CRUD state; `useProjectTasks(projectId)` drawer
  açılınca lazy fetch.
- `frontend/src/pages/Projects.jsx` — grid + drawer state (route değişmez, drawer sadece state).
- `components/projects/ProjectCard.jsx` — isim, tech-stack pill'leri, SVG progress ring
  (`ProgressRing.jsx`), üst üste binen avatarlar (mevcut `TaskAvatar` yeniden kullanılır).
- `components/projects/ProjectDrawer.jsx` — sağdan slide-over: mimari wiki (Markdown görüntüleme
  + Dev Lead için textarea ile düzenleme/kaydet) ve statüye gruplu görev alt listesi.
- `components/projects/ProjectFormModal.jsx` — oluştur/düzenle (isim, tech stack, ekip seçimi).

**Yeni bağımlılık (onay gerekir):** Markdown render için `react-markdown` — repo'da hiçbir
markdown kütüphanesi yok. `react-markdown` aktif bakımlı, HTML'i default'ta render etmediği için
XSS-güvenli, `dangerouslySetInnerHTML` gerektirmez. Başka bağımlılık eklenmez; editör "zengin
editör" değil, düz textarea + önizleme sekmesidir.

Tüm metinler `t('projects.*')` üzerinden — `LanguageContext`'in tr **ve** en sözlüklerine yeni
anahtarlar eklenir (`nav.projects`, `projects.*`, `tasks.comments.*`). Stil: `index.css`'e mevcut
token'larla (`--space-*`, `--radius-*`, `--accent-primary`, `--transition-*`) yeni sınıflar —
ayrıntısı ayrı tasarım-yönü dokümanında (`2026-07-14-project-portfolio-design-direction.md`).

## 7) Görev Yorumları UI

`TaskDetailModal.jsx` presentational kalır: yorum verisi/POST'u yeni
`frontend/src/hooks/useTaskComments.js` + `services/taskService.js`'e eklenen iki çağrıyla gelir;
`TaskBoard.jsx` hook'u bağlayıp props geçer (mevcut `canAct`/`canApprove` deseninin aynısı,
`canComment` de oradan gelir). Modal içinde, durum butonlarının ("Şu duruma taşı") hemen altına
`components/tasks/TaskCommentList.jsx` (avatar+isim+rol rozeti+zaman+metin, kronolojik) ve
`TaskCommentInput.jsx` (oval input + gönder ikonu) eklenir. Avatar/renk için mevcut `TaskAvatar`
yeniden kullanılır (deterministik renk zaten orada var).

## 8) Aşamalı Yol Haritası (revize)

1. **Faz 1 — Şema:** `Project.js`, `Task.js` ekleri (projectId + comments), validator'lar.
2. **Faz 2 — API & Güvenlik:** `permissions.js` (iki dosya) `projects` girdisi,
   `projectScope.js` (+ frontend aynası), `projectRoutes/Controller`, yorum endpoint'leri,
   403 testleri (dev-lead olmayan staff, accountant, intern).
3. **Faz 3 — Nav & Grid:** `navigation.js` + `Sidebar.jsx` `visible()` genişletmesi, `App.jsx`
   route'u, `projectService`/`useProjects`, `Projects.jsx` grid + kart + ring, i18n anahtarları.
4. **Faz 4 — Drawer & Yorumlar:** `ProjectDrawer` (wiki görüntüle/düzenle, `react-markdown`
   kurulumu, görev akışı), `useTaskComments` + modal yorum UI'ı, `index.css` stilleri, mobil
   (drawer → tam ekran sheet).

## Kapsam Dışı (bilinçli olarak yok)

- Yorum düzenleme/silme, @mention, dosya eki, yorumlara gerçek-zamanlı push (socket) — v1'de yok,
  istenirse ayrı iş.
- `progress`'in DB'de saklanması (hesaplanır, bkz. Bölüm 1); proje arşivleme/soft-delete.
- `teamMembers`'ın görev atamasını kısıtlaması; görevleri toplu projeye bağlama ekranı.
- Proje bazlı görünürlük/scope (görev görünürlüğü aynen `taskScope`'ta kalır).
- Zengin metin (WYSIWYG) editörü — düz textarea + markdown önizleme yeterli.

## Dokunulacak Dosyalar (özet)

**Backend (yeni):** `models/Project.js`, `controllers/projectController.js`,
`routes/projectRoutes.js`, `validators/projectValidators.js`, `utils/projectScope.js`
**Backend (değişecek):** `models/Task.js` (projectId+comments), `config/permissions.js`
(`projects` girdisi), `controllers/taskController.js` (createTask projectId + yorum
endpoint'leri), `routes/taskRoutes.js` (yorum route'ları), `validators/taskValidators.js`,
`server.js`/app (route mount)
**Frontend (yeni):** `services/projectService.js`, `hooks/useProjects.js`,
`hooks/useTaskComments.js`, `utils/projectScope.js`, `pages/Projects.jsx`,
`components/projects/ProjectCard.jsx`, `ProjectDrawer.jsx`, `ProgressRing.jsx`,
`ProjectFormModal.jsx`, `components/tasks/TaskCommentList.jsx`, `TaskCommentInput.jsx`
**Frontend (değişecek):** `config/permissions.js`, `config/navigation.js`,
`components/layout/Sidebar.jsx` (visible predicate), `App.jsx` (route),
`services/taskService.js`, `components/tasks/TaskBoard.jsx` (hook bağlama),
`components/tasks/TaskDetailModal.jsx`, görev formu (proje seçici), `context/LanguageContext.jsx`
sözlükleri (tr+en), `index.css`, `package.json` (**yeni bağımlılık: `react-markdown`**)
