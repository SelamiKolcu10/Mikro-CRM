# Müşteri Aktivite Timeline'ı — Mimari & Tasarım Spec'i (P2)

**Tarih:** 2026-07-22
**Yol haritası:** bkz. `2026-07-21-crm-growth-roadmap.md` (P2 — "ucuz kazanım", kurumsal hafıza)
**Model:** Mimari + tasarım Opus ile çıkarıldı; **uygulama Sonnet ile** yapılacak.
**Onaylanan kararlar (kullanıcı):**
1. Kapsam: **Mevcut event'leri birleştir + manuel aktivite kaydı** (arama/toplantı/e-posta/not) — kurumsal hafızanın değeri manuel logdan gelir.
2. Kaynaklar (v1): **DealEvent + LeadEvent + Feedback**. **Portal chat HARİÇ** (gürültü; Faz 2).
3. UI: **Müşteri Detay Drawer** — `LeadDetailDrawer`/`DealDetailDrawer` deseni, `document.body`'ye portal'lı.

---

## 0. Amaç

Bir müşteri hakkındaki tüm etkileşimler bugün dağınık: satış olayları `DealEvent`'te, talep geçmişi `LeadEvent`'te, destek kayıtları `Feedback`'te, ve **hiçbir yerde** kaydedilmeyen aramalar/toplantılar. Çalışan ayrılınca bu bağlam kayboluyor.

Bu modül müşteri kartında **tek, kronolojik, birleşik akış** verir: "bu müşteriyle en son ne konuşuldu, hangi deal hangi aşamada, ne zaman aradık?" — hepsi tek görünümde. İki parça:
- **Birleştirme (okuma):** mevcut event verisini okuma-anında normalize edip harmanla (yeni yazma yolu yok, ucuz).
- **Manuel log (yazma):** temsilci `CustomerEvent` olarak arama/toplantı/e-posta/not ekler — timeline'ın diğer kaynaklarla aynı akışa düşer.

**Kavramsal not:** Bu modül **veri üretmez, veriyi birleştirir** (+ tek yeni küçük koleksiyon: manuel loglar). Deal/Lead/Feedback kendi modüllerinin sahibidir; timeline onları sadece müşteri ekseninde okur.

---

## 1. Veri Modeli

### 1.1 `config/customerEvents.js` (tek kaynak — `config/deals.js` deseni)

```js
// Temsilcinin ELLE eklediği etkileşim türleri (actor zorunlu — bkz. §3.2).
const MANUAL_ACTIVITY_TYPES = ['note', 'call', 'meeting', 'email'];

// Sistem tarafından yazılan müşteri yaşam döngüsü olayları (actor null).
const SYSTEM_ACTIONS = ['created', 'plan_changed'];

// CustomerEvent.action enum'unun tamamı.
const CUSTOMER_EVENT_ACTIONS = [...MANUAL_ACTIVITY_TYPES, ...SYSTEM_ACTIONS];

module.exports = { MANUAL_ACTIVITY_TYPES, SYSTEM_ACTIONS, CUSTOMER_EVENT_ACTIONS };
```

> Frontend `config/customerEvents.js` bunu birebir aynalar — "log aktivite" formundaki tür listesi + kind→ikon/etiket haritası oradan okur. Tek-kaynak enum kuralı (tüm modüllerde: leads/deals/tasks).

### 1.2 `models/CustomerEvent.js` (yeni — `LeadEvent`/`DealEvent` aynası)

Manuel loglar **ve** birkaç müşteri yaşam döngüsü olayı burada saklanır. Diğer kaynaklar (Deal/Lead/Feedback) **kendi koleksiyonlarında kalır**, timeline onları okuma-anında harmanlar (§3.1).

| Alan | Tip | Not |
|------|-----|-----|
| `customer` | ObjectId→Customer, required | index'li |
| `actor` | ObjectId→User, default null | Sistem olaylarında null; manuel türlerde controller doldurmayı zorlar |
| `actorName` | String, required | Denormalize snapshot (LeadEvent deseni — timeline join'siz render) |
| `action` | enum `CUSTOMER_EVENT_ACTIONS`, default `'note'` | |
| `note` | String, ≤2000, default null | Manuel türlerin gövdesi (call/meeting'de opsiyonel özet, note/email'de asıl içerik) |
| `fromPlan` / `toPlan` | String, default null | Yalnız `action:'plan_changed'` |

- `timestamps: { createdAt: true, updatedAt: false }` (LeadEvent/DealEvent ile aynı — olaylar değişmez).
- index: `{ customer: 1, createdAt: -1 }`.
- **Gevşek tutarlılık** (leadController.js:38 felsefesi): CustomerEvent ikincildir; sistem olayı (created/plan_changed) yazımı hata verse bile ana Customer işlemi geri alınmaz. Transaction yok.

### 1.3 Şema değişikliği YOK

`Customer`, `Deal`, `Lead`, `Feedback` şemaları **değişmez**. Timeline bunları mevcut referanslarla bulur:
- Deal: `Deal.customer == :id`  → o deal'lerin `DealEvent`'leri
- Lead: `Lead.linkedCustomer == :id` → o lead'lerin `LeadEvent`'leri
- Feedback: `Feedback.customer == :id` → kaydın kendisi (Feedback'in ayrı event log'u yok — §3.1)

> Migration yok, geri uyumlu. "Ucuz kazanım" gerekçesi tam da bu: mevcut foreign key'ler zaten var.

---

## 2. Birleşik Timeline Öğesi — normalize şekil

Her kaynak, ortak bir öğeye indirgenir. **Server** ham/yapısal veriyi döndürür; **etiket/ikon/renk** client-side pure util'de üretilir (mobil-taşınabilirlik: i18n + görsel eşleme DOM'a değil, veriye bağlı).

```js
// Server → client tek öğe şekli
{
  key,        // React key: `${source}:${id}` (kaynaklar arası çakışmasın)
  source,     // 'customer' | 'deal' | 'lead' | 'feedback'
  kind,       // olay tipi: 'note'|'call'|'meeting'|'email'|'created'|'plan_changed'
              //           |'stage_changed'|'value_changed'|'won'|'lost'|'assigned'
              //           |'status_changed'|'converted'|'feedback_created'
  at,         // ISO createdAt — TEK sıralama anahtarı (desc)
  actorName,  // denormalize (null → i18n 'Sistem')
  note,       // varsa serbest metin
  data,       // kaynağa özel yapısal alanlar (etiket client'ta kurulur):
              //   deal:  { dealId, dealTitle, fromStage, toStage, fromValue, toValue }
              //   lead:  { leadId, leadType, fromStatus, toStatus }
              //   feedback: { feedbackId, feedbackType, status, title }
              //   customer: { fromPlan, toPlan }
  ref,        // navigasyon için: { dealId? , leadId?, feedbackId? }
}
```

**Merge saf fonksiyonu (`utils/customerTimeline.js` — server, testable):**
`buildTimeline({ customerEvents, dealEvents, leadEvents, feedbacks })` → her diziyi yukarıdaki şekle map'ler, tek diziye birleştirir, `at` desc sıralar. DOM/req bağımlılığı yok → **unit test edilebilir** (bkz. §7 doğrulama). Aynı saf mantık ileride RN'de de kullanılabilir.

---

## 3. API & Controller

Yeni bir `permissions` kaynağı **yok** — mevcut `customers` matrisi yeterli (§5). `customerController.js`'e iki fonksiyon eklenir + `routes/customerRoutes.js`'e iki route.

| Method | Route | Yetki | Açıklama |
|--------|-------|-------|----------|
| GET | `/api/customers/:id/timeline` | `customers.read` | Birleşik akış (§3.1). Query: `?before=<ISO>&limit=50`. |
| POST | `/api/customers/:id/activities` | `customers.write` | Manuel log (§3.2). Body: `{ type, note }`. |

### 3.1 `getCustomerTimeline` — birleştirme akışı

```
1. Customer'ı yükle → yoksa 404.
2. Kaynakları PARALEL topla (Promise.all):
   a. customerEvents = CustomerEvent.find({ customer }).sort(-createdAt)
   b. feedbacks      = Feedback.find({ customer }).sort(-createdAt)
   c. leadIds  = Lead.find({ linkedCustomer: id }).distinct('_id')
      leadEvents = LeadEvent.find({ lead: { $in: leadIds } }).populate('lead','type')
   d. deals.read yetkisi VARSA (bkz. §5):
        dealIds  = Deal.find({ customer: id }).distinct('_id')
        dealEvents = DealEvent.find({ deal: { $in: dealIds } }).populate('deal','title')
      YOKSA (intern/support): dealEvents = []   // ciro sızıntısı önlenir
3. items = buildTimeline({ customerEvents, dealEvents, leadEvents, feedbacks })  // §2
4. Cursor + limit:  before verildiyse at < before filtrele; ilk (limit+1) al;
   fazlası varsa hasMore=true, nextCursor = son öğenin at'ı.
5. res.json({ success, data: { items, hasMore, nextCursor } })
```

- **`deals.read` kontrolü controller'da:** `PERMISSIONS.deals.read.includes(req.user.role)` (authorize middleware'in okuduğu aynı matris). Intern **ve support** deal öğelerini hiç görmez — deal event'leri route'a değil, buraya sızabilirdi; bu kontrol o kapıyı kapatır.
- **Cursor stratejisi (v1 basit):** her kaynaktan makul üst sınırla çekilir (v1 hacimleri düşük — getLeads/getDeals'in "hepsini çek, client'ta işle" deseniyle uyumlu). Gerçek server-side sayfalama gerekirse **Faz 2/P4**. `before` timestamp yeterli "daha fazla yükle" için.
- **Feedback normalizasyonu:** Feedback'in event log'u yok → her kayıt **tek** öğe olur (`kind:'feedback_created'`, `at: feedback.createdAt`, `data.status` güncel durum). Durum geçiş geçmişi v1'de yok (Feedback durum event'i tutmuyor).
- **PII / intern:** LeadEvent öğeleri lead'in email/telefonunu **taşımaz** (sadece status/note); dolayısıyla burada ek `redactForIntern` gerekmez. `note` alanı personel-yazımı iç nottur (mevcut leads panelinde de intern'e görünür deseniyle tutarlı).

### 3.2 `logCustomerActivity` — manuel kayıt

```
POST /api/customers/:id/activities   body { type ∈ MANUAL_ACTIVITY_TYPES, note }
1. Customer var mı → 404.
2. Validate (§3.3): type enum'da mı, note ≤2000. note: 'note'/'email' için required,
   'call'/'meeting' için opsiyonel (arama/toplantı loglanır, not opsiyonel özet).
3. CustomerEvent.create({ customer, actor: req.user._id, actorName: req.user.name,
                          action: type, note })
4. Oluşan öğeyi buildTimeline ile tek öğeye normalize edip döndür (201) →
   client optimistic listenin başına ekler.
```

- Manuel türlerde `actor` **zorunlu** (kural şemada değil, controller'da — LeadEvent deseni). Sistem olayları (`created`/`plan_changed`) bu endpoint'ten yazılamaz; onları §3.4 yazar.
- **Not:** v1'de logu **düzenleme/silme yok** (immutable audit izi). Düzeltme Faz 2.

### 3.3 `validators/customerValidators.js` (yeni, küçük — leadValidators deseni)

`validateLogActivity`: `type` ∈ `MANUAL_ACTIVITY_TYPES` (aksi 400), `note` string ≤2000, `note` boşsa yalnız call/meeting'de kabul. express-validator zinciri, `routes`'ta uygulanır.

### 3.4 Yaşam döngüsü sistem olayları (lean hook — `customerController` içinde)

Kurumsal hafıza için ucuz iki hook (mevcut `execute*` fonksiyonlarına tek satır):
- `executeCreateCustomer` sonrası → `CustomerEvent({ action:'created', actor:null, actorName:'Sistem' })`.
- `executeUpdateCustomer` içinde `plan` değiştiyse → `CustomerEvent({ action:'plan_changed', fromPlan, toPlan, actor:req.user, actorName })`.

> Neden AuditLog'a değil buraya: AuditLog hash-zincirli güvenlik izi, müşteri-görünür timeline değil (LeadEvent'in AuditLog'dan ayrı tutulmasıyla aynı gerekçe). İkisi farklı amaç. Bu hook'lar gevşek-tutarlı: hata verse ana işlem geri alınmaz.

---

## 4. Frontend Mimarisi & UI/UX

### 4.1 Veri katmanı (mobil-taşınabilir — global kural)
- **`hooks/useCustomerTimeline.js`** — fetch (cursor'lu "daha fazla yükle") + `logActivity` mutation (optimistic prepend). İş mantığı DOM'suz, RN'de yeniden kullanılabilir. `useDealEvents`/`useLeads` deseni.
- **`utils/customerTimeline.js`** (frontend, pure) — `describeEvent(item, t)` → `{ icon, label, tone }`; `groupByDay(items)`. `kind` → i18n etiket eşlemesi burada (server sadece yapısal veri döndürür). DOM/window yok.
- **`config/customerEvents.js`** (mirror) — `MANUAL_ACTIVITY_TYPES` (form seçenekleri).
- **`services/customerService.js`** (edit) — `getTimeline(id, { before, limit })`, `logActivity(id, { type, note })`.

### 4.2 Bileşenler (mevcut görsel dili yeniden kullan — YENİ tasarım dili değil)

| Dosya | Temel aldığı mevcut desen |
|-------|---------------------------|
| `components/customers/CustomerDetailDrawer.jsx` (yeni) | `LeadDetailDrawer.jsx` (üstte özet + altta timeline + aksiyon) |
| `components/customers/CustomerTimeline.jsx` (yeni) | LeadDetailDrawer'ın olay listesi bölümü |
| `components/customers/LogActivityForm.jsx` (yeni) | LeadDetailDrawer'ın "not ekle" formu (tür seçici + textarea) |
| `pages/Customers.jsx` (edit) | Satıra tıkla → drawer aç (mevcut tablo) |

### 4.3 ⚠️ Portal kuralı (bizi iki kez ısırdı — hafızada)
`CustomerDetailDrawer` **`document.body`'ye `createPortal` ile** render edilmeli. `.page-container`/`.page-enter` `position:fixed`'i tuzağa düşürüyor (bkz. hafıza: *fixed-overlays-need-portal*; `LeadDetailDrawer.jsx:102,260` aynı desen — oradan kopyala).

### 4.4 Görsel tasarım (deliberate, tutarlı)
- **Drawer başlığı:** müşteri adı + şirket + plan rozeti + MRR (Customers tablosundaki `revenue-impact` dili). Sağda kapat.
- **Timeline:** dikey zaman çizgisi, **güne göre gruplu** ("Bugün / Dün / 21 Tem"). Her öğe: kaynak ikonu (renkli nokta — deal=mor, lead=mavi, feedback=turuncu, manuel=nötr), etiket (`describeEvent`), aktör adı + saat, varsa not gövdesi. Deal öğelerinde küçük tutar/aşama rozeti; lead'de durum geçişi; feedback'te tür+durum rozeti.
- **Log aktivite (drawer üstünde, timeline'ın hemen üzerinde):** tür seçici (not/arama/toplantı/e-posta ikon-butonları) + textarea + "Ekle". `customers.write` yoksa gizli (`PermissionGate`).
- **Boş durum:** "Bu müşteriyle henüz kayıtlı etkileşim yok" + ilk notu ekle CTA'sı.
- **Navigasyon:** deal/lead/feedback öğesine tıklama v1'de **salt-gösterim** (rozet); ilgili modüle derin link **Faz 2** (scope creep koruması).

### 4.5 Customers sayfası entegrasyonu
- Satıra tıklama (ad hücresi) drawer'ı açar; mevcut satır-içi aksiyon butonları (feedback/portal/düzenle/sil) `stopPropagation` ile korunur.
- Drawer, `customers.read` olan herkese açık (intern/support dahil — deal öğeleri onlarda gelmez, §3.1).

---

## 5. RBAC

**Yeni kaynak yok** — mevcut `customers` matrisi kullanılır:
- **Timeline görüntüleme** = `customers.read` → super_admin, accountant, staff, support, intern.
- **Manuel log** = `customers.write` → super_admin, staff. *(Support'un log yazması doğal bir istek ama write scope'u genişletir → **Faz 2** notu; v1 mevcut customer-write kapısında kalır.)*
- **Deal-kaynaklı öğeler** = ek olarak `deals.read` (super_admin, staff, accountant) gerekir; **intern & support deal öğelerini görmez** (ciro hassas — deal-pipeline spec §5 kararının timeline'a taşınması). Kontrol controller'da (§3.1).
- Lead & feedback öğeleri kendi read izinleriyle (ikisi de herkeste) → her zaman görünür.

`permissions.js` (backend + frontend mirror) **değişmez**. `App.jsx` route değişmez (Customers zaten var). Sidebar değişmez.

---

## 6. v1 Kapsam Sınırı (scope creep koruması)

**İÇERİDE:** `CustomerEvent` modeli (manuel not/arama/toplantı/e-posta + created/plan_changed sistem olayı) + birleşik okuma-anı timeline (CustomerEvent+DealEvent+LeadEvent+Feedback) + `deals.read` filtresi + `CustomerDetailDrawer` (özet + timeline + log formu, portal'lı, güne göre gruplu) + cursor'lu "daha fazla" + i18n.

**DIŞARIDA (sonraki fazlar):**
- Portal chat / Message kaynağı → **Faz 2** (gürültü + özetleme kararı)
- Timeline öğesinden ilgili Deal/Lead/Feedback'e derin link → Faz 2
- Loglanan aktiviteyi düzenleme/silme → Faz 2
- Support rolüyle log yazma → Faz 2
- Doküman/dosya ekleme (roadmap'te "doküman") → Faz 2
- Gerçek zamanlı socket push (yeni olay canlı düşsün) → Faz 2
- Feedback durum-geçiş geçmişi (Feedback event log'u yok) → ayrı iş
- Sunucu-taraf timeline arama/gerçek sayfalama → **P4** (analitik altyapısıyla)

---

## 7. Sonnet için dokunulacak dosyalar

**Backend (yeni):** `config/customerEvents.js`, `models/CustomerEvent.js`, `utils/customerTimeline.js` (pure merge), `validators/customerValidators.js`
**Backend (düzenle):** `controllers/customerController.js` (+`getCustomerTimeline`, +`logCustomerActivity`, +create/update'te sistem olayı hook'u), `routes/customerRoutes.js` (+2 route)
**Frontend (yeni):** `components/customers/CustomerDetailDrawer.jsx`, `components/customers/CustomerTimeline.jsx`, `components/customers/LogActivityForm.jsx`, `hooks/useCustomerTimeline.js`, `utils/customerTimeline.js` (pure describe/group), `config/customerEvents.js` (mirror)
**Frontend (düzenle):** `pages/Customers.jsx` (satır→drawer), `services/customerService.js` (+getTimeline, +logActivity), `i18n/en.json` + `i18n/tr.json` (customerTimeline.* anahtarları), `index.css` (timeline stilleri — mevcut drawer/olay listesi sınıflarını yeniden kullan)

**Doğrulama** (hafıza: puppeteer + `admin@microcrm.com`/`admin123`):
- `utils/customerTimeline.buildTimeline` unit test: karışık kaynaklar doğru `at` desc sıralanıyor mu, key çakışması yok mu.
- Drawer render: müşteri özeti + gruplu timeline; deal+lead+feedback öğeleri karışık görünüyor mu.
- Manuel log: arama ekle → optimistic prepend → reload sonrası kalıcı.
- **Intern/support senaryosu:** deal'i olan bir müşterinin timeline'ında intern **deal öğelerini görmemeli**, ama lead/feedback/manuel öğeleri görmeli.
- "Daha fazla yükle" cursor'u: limit sınırında ikinci sayfa çakışmasız geliyor mu.
```