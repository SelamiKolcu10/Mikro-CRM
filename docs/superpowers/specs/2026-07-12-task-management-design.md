# Görev Yönetimi (Task Management) Modülü — Tasarım

Tarih: 2026-07-12
Durum: Onaylandı (kullanıcı + Fable mimari incelemesi)

## Amaç

Micro-CRM'e Jira benzeri, departman bazlı bir iç görev yönetimi (task) modülü eklemek:
yöneticiler/liderler görev oluşturup atar, personel görevi işler, durumu günceller,
liderler işi onaylar. Mevcut Feedback (müşteri destek) modülünden tamamen bağımsız,
kendi başına çalışan bir MVP.

## 1) Roller & Departman

Mevcut `role` enum'u **değişmeden** kalır: `super_admin, accountant, staff, support, intern`
(`backend/config/permissions.js`). Departman ve liderlik, role'den bağımsız iki yeni alan
olarak `User` modeline eklenir — role "ne yapabilirsin", departman/liderlik "hangi ekipte
ve ne yetkiyle" sorusuna cevap verir.

`backend/models/User.js` üzerine eklenecek alanlar:
- `department`: `String`, enum `['development', 'design', 'hr', 'marketing']`, **opsiyonel**.
  Mevcut roller (accountant, support gibi) bu alanı boş bırakabilir; task modülüne dahil
  olmayan kullanıcılar için zorunlu değildir.
- `isDepartmentLead`: `Boolean`, default `false`, **opsiyonel**. Bir kullanıcı aynı anda hem
  `role: staff` hem `isDepartmentLead: true` olabilir — liderlik fonksiyonel rolün üzerine
  binen ayrı bir yetkidir, rolü değiştirmez/kaybettirmez.
- **Model-level validasyon:** `isDepartmentLead: true` iken `department` boş/null olamaz
  (geçersiz durumu şemada engelle).
- Bir departmanda **birden fazla lider olabilir** — hepsi o departmanın onay yetkisine sahiptir
  (tekil lider kısıtı yok).
- `department` veya `isDepartmentLead` her değiştiğinde `tokenVersion` artırılır (rol
  değişiminde yapıldığı gibi — `bumpTokenVersion()`), eski JWT'ler yeni yetkiyi/departmanı
  göstermeye devam etmesin diye.

## 2) Task Modeli

Yeni `backend/models/Task.js`:

| Alan | Tip | Not |
|---|---|---|
| `title` | String, required | |
| `description` | String | |
| `department` | enum, required | **Oluşturulunca sabitlenir, sonradan değiştirilemez.** Reassignment/transfer akışı MVP kapsamı dışı — yanlış atanmış bir task silinip yeniden oluşturulur. |
| `priority` | enum: `critical, high, medium, low`, default `medium` | |
| `deadline` | Date, opsiyonel | |
| `status` | enum: `todo, in_progress, in_review, done`, default `todo` | |
| `assignedTo` | ref User, required | **Validasyon:** bu kullanıcının `department` alanı, task'ın `department` alanıyla birebir aynı olmalı. Departmanı olmayan kullanıcıya (accountant/support gibi) task atanamaz — validasyon reddeder, frontend "bu kullanıcının departmanı yok, önce departman atayın" mesajı gösterir. |
| `assignedBy` | ref User, required | Sadece **audit/metadata** amaçlı — hiçbir yetkilendirme kararında kullanılmaz. |
| `timestamps` | createdAt/updatedAt | Mongoose default |

## 3) İzinler (Permissions)

`backend/config/permissions.js` içine yeni kaynak eklenir (mevcut `chat.assign` deseniyle tutarlı):

```js
tasks: {
  read: [SUPER_ADMIN, ACCOUNTANT, STAFF, SUPPORT, INTERN], // görünürlük asıl olarak taskScope ile daraltılır
  write: [SUPER_ADMIN, STAFF],   // rol-seviyesi kaba filtre — asıl "kim gerçekten oluşturabilir" kontrolü aşağıda
  assign: [SUPER_ADMIN, STAFF],
  approve: [SUPER_ADMIN, STAFF], // rol-seviyesi kaba filtre — asıl onay kontrolü aşağıda
}
```

Matristeki `write`/`approve` girdileri sadece kaba bir rol filtresidir (örn. `intern`'i
endpoint'e hiç sokmaz). **Asıl iş kuralı matriste değil, controller'da `taskScope`'un
yanına eklenecek ayrı bir kontrolde yaşar:** görev oluşturma/atama için `isDepartmentLead
=== true || role === super_admin` şart koşulur — sadece `role: staff` olmak (lider
olmadan) task oluşturmaya yetmez. Aynı kural onayda da geçerlidir (bkz. Bölüm 4).

**Departman bazlı görünürlük matriste ifade edilmez** (matris rol→aksiyon eşlemesi yapar,
satır/veri bazlı filtreleme yapmaz). Bunun yerine tek, paylaşılan bir yardımcı fonksiyon:

`backend/utils/taskScope.js` — `taskScope(user)` → Mongo filtre objesi döner:
- normal çalışan (`isDepartmentLead: false`): `{ $or: [{ department: user.department }, { assignedTo: user._id }] }`
- `isDepartmentLead: true`: `{ department: user.department }` (tüm departman)
- `super_admin`: `{}` (hepsi)

Aynı mantık, DOM'dan bağımsız sade bir fonksiyon olarak frontend'de de aynalanır
(`frontend/src/utils/taskScope.js` benzeri) — hem UI filtrelemesi hem de gelecekteki
mobil port için iş mantığı DOM'a bağımlı kalmasın diye.

## 4) Workflow / Onay Akışı

```
todo → in_progress → in_review → done
```

- `todo → in_progress → in_review`: `assignedTo` olan kişi serbestçe taşıyabilir.
- `in_review → done`: yalnızca **o anki** durum kontrol edilir — `isDepartmentLead: true`
  **ve** `department === task.department` olan biri, **veya** `super_admin`. `assignedBy`
  geçmişi hiçbir zaman yetkilendirme için kullanılmaz (bir lider departman değiştirse/silinse
  bile task'ın onay yetkisi o departmanın *güncel* liderlerinde/super_admin'de kalmaya devam
  eder — task sonsuza dek onaysız takılı kalmaz).

## 5) Frontend

- Yeni sayfa: `frontend/src/pages/Tasks.jsx` — Kanban pano, 4 sütun (`todo/in_progress/in_review/done`),
  sürükle-bırak için `@dnd-kit`.
- İş mantığı DOM/sürükle-bırak bileşenlerinden ayrı tutulur: `useTasks` hook + `taskService.js`
  (fetch, mutate, izin kontrolü) — mobil (React Native) port hedefine uygun.
- `RoleGuard`/`PermissionGate` görev oluşturma butonunu `tasks.write` iznine göre gösterir/gizler.
- `in_review → done` sürüklemesi, `taskScope`'un onay yetkisi kontrolüyle sınırlanır — yetkisi
  olmayan kullanıcı için o sürükleme engellenir/UI'da devre dışı görünür.
- Görev oluşturma formunda departman seçilir, ardından o departmandaki kullanıcılar arasından
  `assignedTo` seçilir (departmanı olmayan kullanıcılar listede görünmez).

## Kapsam Dışı (MVP'de yok)

- Departman CRUD ekranı (departmanlar sabit kod-seviyesi enum).
- Task ↔ Feedback/Customer ilişkilendirmesi.
- Task transfer/devretme akışı (departman değişikliği).
- Çoklu assignee, yorum/ek dosya, bildirimler.

## İnceleme Notu

Bu tasarım, Fable (claude-fable-5) tarafından iki geçişte mimari olarak incelendi:
ilk geçişte 7 bulgu (role enflasyonu, çelişkili kurallar, stale-approver riski vb.) tespit
edildi ve tasarıma işlendi; ikinci geçişte düzeltmelerin bulguları gerçekten çözdüğü ve
yeni bir tutarsızlık yaratmadığı (bir model validasyonu hariç, o da yukarıda eklendi)
doğrulandı.
