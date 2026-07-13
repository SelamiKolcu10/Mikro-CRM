# Tasks Workspace Upgrade — Tasarım

Tarih: 2026-07-13 | Durum: Onay bekliyor

## Amaç

`Tasks.jsx`'i tek panolu görünümden, 3 sekmeli bir çalışma alanına genişletmek: Aktif Pano (Kanban),
Görev Geçmişi (Arşiv), Aktivite Isı Haritası — artı üstte ortak filtre çubuğu (departman/atanan
kişi/"sadece benim görevlerim") ve mobilde tek-sütun kaydırmalı görünüm.

## 1) Yeni Backend Modeli: `TaskActivity`

Isı haritasının istediği "hangi gün kaç görev tamamlandı / incelemeye alındı" ayrımı, mevcut
`Task.updatedAt` (tek zaman damgası) ile yapılamaz — her durum geçişini ayrı kaydetmek gerekiyor.

`backend/models/TaskActivity.js` (yeni, küçük, sadece ekleme amaçlı):
```
task: ObjectId (ref Task)
changedBy: ObjectId (ref User)
department: String (o anki task.department'ın anlık görüntüsü — scoping için)
fromStatus / toStatus: String (TASK_STATUSES)
createdAt: Date (timestamps:true)
```
`taskController.updateTaskStatus` başarılı her durum değişikliğinde bir kayıt ekler (fire-and-forget
değil — aynı transaction/await zinciri içinde, mevcut save'den hemen sonra).

## 2) Yeni Endpoint: Isı Haritası

`GET /api/tasks/activity-heatmap?department=&userId=` — son 365 günü günlük gruplanmış olarak
döner: `[{ date: 'YYYY-MM-DD', total, byStatus: { done: n, in_review: n, ... } }]`. Görünürlük kuralı
`taskScope`'un aynısı (super_admin/intern hepsini görür, lider kendi departmanını, üye sadece
kendi `changedBy` kayıtlarını) — `TaskActivity`'nin kendi alanları (`department`/`changedBy`) üzerinden,
`Task`'a join olmadan uygulanır.

## 3) Kanban Pano Değişiklikleri (Tab 1)

- **Done sütunu 7 gün kuralı**: `TaskBoard.jsx`'te client-side filtre — `status==='done' && updatedAt`
  7 günden eskiyse pano render'ından çıkarılır (veri hâlâ `useTasks`'tan geliyor, sadece görüntüleme
  filtresi; backend/API değişmiyor).
- **Avatar**: Yeni `TaskAvatar.jsx` — kullanıcı `_id`'sinden basit bir hash ile sabit bir renk seçen,
  baş harfleri gösteren yuvarlak rozet (DB şeması değişmiyor).
- **Rol rozeti**: "Plan rozeti" yerine mevcut `ROLE_LABELS`/`.badge-*` deseniyle rol rozeti (ek CSS
  gerekmiyor, zaten var olan sınıflar).

## 4) Görev Geçmişi (Tab 2)

Ayrı bir API çağrısı yok — `useTasks()`'un zaten çektiği tam listeden `status==='done'` olanlar
tabloya dökülür (bu CRM'in veri hacminde ayrı bir arşiv endpoint'i/pagination'a gerek yok — YAGNI).
Sütunlar: ID, Başlık, Departman, Atanan, Tamamlanma Tarihi, Atayan. `updatedAt`'e göre azalan sıralama.

## 5) Aktivite Isı Haritası (Tab 3)

`frontend/src/components/tasks/TaskHeatmap.jsx` — GitHub tarzı 52 haftalık ızgara, mor tonlarında
yoğunluk, hücre üstünde tooltip (`"12 Kasım: 3 görev tamamlandı, 1 görev incelemeye alındı"`).
Üstteki filtre çubuğuna bağlı: departman/kullanıcı seçimi `activity-heatmap` sorgu parametrelerini
değiştirir.

## 6) Ortak Filtre Çubuğu

`Tasks.jsx`'te tek bir filtre state'i (departman/atanan kişi/"sadece benim görevlerim") — her 3 sekmeye
de prop olarak geçiyor. Filtre mantığı `useTasks.js`'e eklenen saf bir `applyFilters(tasks, filters)`
fonksiyonunda yaşıyor (DOM'dan bağımsız, mobil port hedefiyle tutarlı).

## 7) Mobil Uyumluluk

`TaskBoard.jsx`: masaüstünde mevcut 4-sütun yan yana görünüm; dar ekranda (`max-width: 768px`, mevcut
breakpoint) 4 sütun başlığı yatay bir sekme çubuğuna döner (`Yapılacak (4)` gibi sayaçlarla), tıklanan
sütun tam genişlikte tek başına gösterilir. Yatay taşma olmaz.

## Kapsam Dışı (bilinçli olarak yok)

Yorum/dosya eki/görev devri (spec'te zaten belirtilmişti). Ayrı bir arşiv API'si/pagination (veri
hacmi gerektirmiyor). İsim maskeleme vb. — bu tasarımın konusu değil.

## Dokunulacak Dosyalar (özet)

**Backend (yeni):** `models/TaskActivity.js`, `controllers/taskController.js` (updateTaskStatus'a ekleme + yeni `getActivityHeatmap`), `routes/taskRoutes.js` (yeni route), `validators/taskValidators.js` (yeni query validator)
**Frontend (yeni):** `components/tasks/TaskAvatar.jsx`, `components/tasks/TaskHistory.jsx`, `components/tasks/TaskHeatmap.jsx`, `components/tasks/TaskFilterBar.jsx`
**Frontend (değişecek):** `pages/Tasks.jsx` (sekme yapısı), `components/tasks/TaskBoard.jsx` (7 gün kuralı + mobil), `components/tasks/TaskCard.jsx` (avatar+rol rozeti), `hooks/useTasks.js` (filtre + heatmap fetch), `services/taskService.js` (yeni endpoint çağrısı), `index.css` (heatmap/sekme/filtre stilleri)
