# Deal / Fırsat Pipeline — Mimari & Tasarım Spec'i (P1)

**Tarih:** 2026-07-21
**Yol haritası:** bkz. `2026-07-21-crm-growth-roadmap.md` (P1 — en yüksek ROI, satış omurgası)
**Model:** Mimari + tasarım Opus ile çıkarıldı; **uygulama Sonnet ile** yapılacak.
**Onaylanan kararlar (kullanıcı):**
1. Dönüşüm: **Qualified Lead → Deal + otomatik Customer** (tek aksiyon, iki gap'i kapatır)
2. Aşamalar: **İlk Temas → Görüşme → Teklif → Pazarlık → Kazanıldı/Kaybedildi** (stage→olasılık haritalı)
3. Yetki: **read = super_admin + staff + accountant**, **write = super_admin + staff**, **intern hariç** (ciro hassas)

---

## 0. Amaç

Satış hunisi bugün Lead'de bitiyor; parasal boyut yok. Bu modül "**bu ay ne kadar ciro bekliyoruz?**" sorusunu cevaplayan Deal katmanını ekler: değer + kazanma olasılığı + tahmini kapanış tarihi taşıyan bir Kanban pipeline.

**Kavramsal ayrım (önemli):**
- **Lead = nitelendirme** ("bu fırsat kovalanmaya değer mi?") — mevcut funnel korunur.
- **Deal = kapama** ("ne kadar, ne zaman, kazanır mıyız?") — yeni katman, Lead'in *altında/sonrasında*.
- Lead'in mevcut `won/lost` status'leri **değişmez** (migration yok); dönüşüm ayrı bir eksen (`lead.convertedDeal`).

---

## 1. Veri Modeli

### 1.1 `config/deals.js` (tek kaynak — `config/leads.js` deseni)

```js
const DEAL_STAGES = ['initial_contact', 'meeting', 'proposal', 'negotiation', 'won', 'lost'];

// Aşamaya göre VARSAYILAN kazanma olasılığı — stage değişince uygulanır,
// kullanıcı deal bazında override edebilir (bkz. §3.3). Tek kaynak: hem model
// default'u hem forecast hesabı buradan okur.
const DEAL_STAGE_PROBABILITY = {
  initial_contact: 10,
  meeting: 30,
  proposal: 50,
  negotiation: 70,
  won: 100,
  lost: 0,
};

const OPEN_STAGES = ['initial_contact', 'meeting', 'proposal', 'negotiation'];
const CLOSED_STAGES = ['won', 'lost'];

// Multi-currency İLERİDE (roadmap infra) — v1 pratikte hep TRY, ama alan
// baştan var ki sonradan migration gerekmesin (mobil/mimari kuralı: bedelsiz
// yerde ileriye hazırla).
const DEAL_CURRENCIES = ['TRY', 'USD', 'EUR'];

module.exports = {
  DEAL_STAGES, DEAL_STAGE_PROBABILITY, OPEN_STAGES, CLOSED_STAGES, DEAL_CURRENCIES,
};
```

### 1.2 `models/Deal.js`

| Alan | Tip | Not |
|------|-----|-----|
| `title` | String, required, ≤150 | Task.title deseni |
| `customer` | ObjectId→Customer, **required** | Her deal bir müşteri hesabına ait |
| `lead` | ObjectId→Lead, default null | Köken izi (dönüşümle geldiyse) |
| `value` | Number, required, min 0 | Anlaşma tutarı |
| `currency` | String, enum `DEAL_CURRENCIES`, default `'TRY'` | Multi-currency hazır |
| `stage` | String, enum `DEAL_STAGES`, default `'initial_contact'` | Kanban kolonu |
| `probability` | Number, min 0, max 100 | Stage default'undan gelir, override edilebilir (§3.3) |
| `expectedCloseDate` | Date, default null | Forecast ekseni |
| `owner` | ObjectId→User, required | Sorumlu satış temsilcisi |
| `lostReason` | String, ≤500, default `''` | Yalnız `stage='lost'` iken anlamlı |
| `closedAt` | Date, default null | won/lost'a geçince set edilir → "bu ay kapanan" sorgusu event taramadan çözülür |

- `timestamps: true`
- `optimisticConcurrency: true` — **drag-drop için zorunlu** (Task.js deseni: iki kişi aynı deal'i eşzamanlı taşırsa VersionError → controller 409'a çevirir).
- İndeksler: `{ stage: 1, expectedCloseDate: 1 }`, `{ owner: 1 }`, `{ customer: 1 }`.

**Saklanmayan türevler** (`withComputedFields` deseni — leadController.js:16):
- `weightedValue = value * probability / 100`
- `isOpen = OPEN_STAGES.includes(stage)`

> Neden hesaplanıyor, saklanmıyor: `Project.progress` deseni. `probability` değişince weighted otomatik doğru kalır, drift yok. (Lead `score`'un aksine — o statik tek-seferlik; bu her okumada ucuz bir çarpma.)

### 1.3 `models/DealEvent.js` (`LeadEvent` aynası)

Timeline + denetim izi. **P2 (birleşik müşteri timeline'ı) bunu doğrudan besleyecek**, o yüzden LeadEvent ile aynı şekil.

| Alan | Tip |
|------|-----|
| `deal` | ObjectId→Deal, required |
| `actor` | ObjectId→User, null (sistem) |
| `actorName` | String |
| `action` | enum: `created, stage_changed, value_changed, note_added, won, lost, assigned` |
| `fromStage` / `toStage` | String |
| `fromValue` / `toValue` | Number (yalnız value_changed) |
| `note` | String |

- `timestamps: true`, index `{ deal: 1, createdAt: -1 }`.
- **Gevşek tutarlılık** (leadController.js:38 felsefesi): Deal ana kayıt, DealEvent ikincil — event yazımı hata verse bile Deal kaybolmaz. Transaction gerekmez.

### 1.4 `models/Lead.js` — küçük eklemeler (migration'sız, geri uyumlu)

```js
// Bu lead bir Deal'e dönüştürüldüyse referansı — çift dönüşümü engeller +
// panelde "Deal'e dönüştürüldü" rozeti/linki için. null = henüz dönüşmemiş.
convertedDeal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', default: null },
```
- `LeadEvent` action enum'una `'converted'` eklenir.
- Lead `status` enum'una **dokunulmaz** (won/lost aynen kalır).

---

## 2. Dönüşüm Akışı — Lead → Deal + Customer (onaylanan omurga)

`POST /api/leads/:id/convert` — `leads.write` (super_admin + staff). Body: `{ title?, value, currency?, expectedCloseDate?, ownerId? }` (value modalda girilir; `budgetRange` client-side bir öneri değeri ön-doldurur).

**Sıra (partial-failure güvenli — transaction gerektirmez):**
1. Lead'i yükle. `convertedDeal != null` ise **409** ("Bu talep zaten dönüştürülmüş").
2. **Customer bul/oluştur:** `lead.linkedCustomer` varsa onu kullan; yoksa `Customer.findOne({ email })`; o da yoksa `Customer.create({ name, email, company, source: mapLeadSourceToCustomerSource() })`. (email unique → idempotent, yarış güvenli.)
3. **Deal oluştur:** `{ title: title || \`${lead.company || lead.name} — Teklif\`, customer, lead: lead._id, value, currency, owner: ownerId || req.user._id, stage: 'initial_contact', probability: DEAL_STAGE_PROBABILITY.initial_contact, expectedCloseDate }`.
4. Lead'i güncelle: `lead.convertedDeal = deal._id; lead.linkedCustomer = customer._id` → save.
5. `LeadEvent(action:'converted')` + `DealEvent(action:'created')`.
6. Deal'i populate edip döndür (frontend Leads panelinden Deals board'una yönlendirebilir).

> **Neden bu sıra:** Adım 2 hata verirse hiçbir şey oluşmaz. Adım 3 hata verirse ortada yalnız (varsa yeni) bir Customer kalır — zararsız, çift kayıt yok (email unique). Bu, projenin mevcut "gevşek tutarlılık" tercihiyle uyumlu (leadController.js:38).

**Bağımsız deal:** Lead olmadan da deal açılabilir — `POST /api/deals` body `{ title, customerId, value, currency?, stage?, expectedCloseDate?, ownerId? }`. Mevcut bir Customer seçilir (zorunlu).

---

## 3. API & Controller

Tümü `deals` kaynağı, RBAC §5. `authorize` middleware + route guard mevcut desenle (routes/leadRoutes.js).

| Method | Route | Açıklama |
|--------|-------|----------|
| GET | `/api/deals` | Hepsi; populate `customer(name,email,company)`, `owner(name,email)`, `lead(_id,type)`; `withComputedFields` (weightedValue, isOpen); `sort(createdAt:-1)`. **Per-kişi scope YOK** — leads/getTasks deseni, herkes hepsini görür. |
| GET | `/api/deals/:id/events` | Timeline (en yeni üstte) |
| POST | `/api/deals` | Bağımsız deal (§2) |
| PATCH | `/api/deals/:id/stage` | **Drag-drop.** Body `{ stage, __v }`. Optimistic concurrency → **409**. Stage default olasılığını uygular *(override edilmemişse — §3.3)*; won/lost'a geçişte `closedAt=now`, geri açılışta `closedAt=null`. `DealEvent(stage_changed | won | lost)`. |
| PATCH | `/api/deals/:id` | Alan düzenle: `value, probability, expectedCloseDate, title, ownerId, lostReason`. value değişince `DealEvent(value_changed, from/toValue)`. |
| POST | `/api/deals/:id/notes` | `DealEvent(note_added)` |
| POST | `/api/leads/:id/convert` | Dönüşüm (§2) |

### 3.3 Olasılık override kuralı
- Stage değişince: kullanıcı bu deal için `probability`'yi elle set etmediyse → yeni stage'in default'u uygulanır.
- Elle set edildiyse: bir `probabilityManual: Boolean` bayrağı yerine daha basit yol — **stage PATCH'i her zaman default'u uygular; ayrı `PATCH /:id` ile probability elle değiştirilebilir.** v1 için yeterli; "manuel kilit" davranışı Faz 2. *(Sonnet: basit tut — stage değişimi default'u yazar, kullanıcı isterse sonra düzenler.)*

### 3.4 Forecast — ayrı endpoint YOK (v1)
Özet metrikler (toplam açık pipeline, ağırlıklı forecast, bu ay kapanması beklenen, bu ay kazanılan) **client-side** `/api/deals` listesinden hesaplanır — getLeads yorumundaki desen (leadController.js:93 "sayımlar frontend'de client-side"). Sunucu tarafı aggregation **P4 (Satış Analitiği)** işi.

---

## 4. Frontend Mimarisi & UI/UX Tasarımı

### 4.1 Veri katmanı (mobil-taşınabilir — global kural)
- **`hooks/useDeals.js`** — fetch + mutations + optimistic update. İş mantığı DOM'dan bağımsız (RN'de yeniden kullanılabilir). `useLeads.js` deseni.
- **`utils/dealForecast.js`** — saf fonksiyonlar: `computeForecast(deals)`, `formatCurrency(value, currency)`. DOM/window yok. RN buradan aynen okur.

### 4.2 Bileşenler (mevcut görsel dili yeniden kullan — yeni tasarım dili DEĞİL)
| Dosya | Temel aldığı mevcut desen |
|-------|---------------------------|
| `pages/Deals.jsx` | `pages/Tasks.jsx` (board sayfası) |
| `components/deals/DealBoard.jsx` | `TaskBoard.jsx` (kolonlar + drag-drop) |
| `components/deals/DealColumn.jsx` | `TaskColumn.jsx` |
| `components/deals/DealCard.jsx` | `TaskCard.jsx` + `LeadDetailDrawer` rozet dili |
| `components/deals/DealDetailDrawer.jsx` | `LeadDetailDrawer.jsx` (timeline + not + düzenle) |
| `components/deals/DealFormModal.jsx` | `ProjectFormModal.jsx` |
| `components/deals/ConvertLeadModal.jsx` | Leads panelinden açılır (value gir + tarih) |
| `components/deals/ForecastSummaryBar.jsx` | Dashboard stat kartları dili |

### 4.3 Görsel tasarım (deliberate, tutarlı — jenerik değil)
- **DealCard:** başlık; müşteri adı (ikincil); **değer büyük ve öne çıkan** (`formatCurrency`, currency sembolü); **olasılık halkası** (`ProgressRing`/`ContributionRing` yeniden kullanılır); tahmini kapanış tarihi (geçmişse uyarı rengi); sahip avatarı (`EmployeeAvatar`). Stage'e göre ince sol kenar rengi (won=yeşil, lost=gri/kırmızı, açık=nötr).
- **Kolon başlığı:** stage adı + adet + **Σ değer** + **Σ ağırlıklı forecast** (ikincil, küçük).
- **ForecastSummaryBar (board üstü):** 4 metrik — Açık Pipeline (Σ value), Ağırlıklı Forecast (Σ weighted), Bu Ay Kapanması Beklenen, Bu Ay Kazanılan. Dashboard'daki `AreaChart`/stat kartı diliyle.
- **Won/Lost kolonları:** görsel olarak ayrışsın (kapanmış); lost'a bırakınca `lostReason` soran küçük prompt.

### 4.4 ⚠️ Portal kuralı (bizi iki kez ısırdı — hafızada)
DealDetailDrawer, ConvertLeadModal, DealFormModal ve tooltip'ler **`document.body`'ye portal edilmeli.** `.page-container`/`.page-enter` `position:fixed`'i tuzağa düşürüyor. (bkz. hafıza: *fixed-overlays-need-portal*.)

### 4.5 Leads entegrasyonu
- `LeadDetailDrawer`'a **"Deal'e Dönüştür"** butonu (yalnız `convertedDeal == null` iken). Tıklayınca `ConvertLeadModal`.
- Dönüşmüş lead'de **"Deal'e dönüştürüldü →"** rozeti/linki (Deals board'una gider).

---

## 5. RBAC (onaylanan)

`config/permissions.js` (backend) + frontend mirror:
```js
deals: {
  read:  [ROLES.SUPER_ADMIN, ROLES.STAFF, ROLES.ACCOUNTANT], // accountant forecast için
  write: [ROLES.SUPER_ADMIN, ROLES.STAFF],
},
```
- **Intern HARİÇ** — deal değeri hassas ciro verisi; leads'teki gibi maskeleme değil, **tamamen kapalı** (route intern'i hiç sokmaz, `redactForIntern` gerekmez).
- App.jsx route: `<RoleGuard allow={[SUPER_ADMIN, STAFF, ACCOUNTANT]}>`.
- Sidebar: "Fırsatlar / Pipeline" girişi aynı rollere.

---

## 6. v1 Kapsam Sınırı (scope creep koruması)

**İÇERİDE:** Deal modeli + Kanban board + drag-drop + stage/olasılık + forecast özeti (client-side) + Lead→Deal→Customer dönüşümü + DealEvent timeline + RBAC.

**DIŞARIDA (sonraki fazlar):**
- Özelleştirilebilir aşamalar (v1 sabit enum — tüm modüller sabit enum, tutarlılık) → Faz 2
- Sunucu-taraf satış analitiği / forecast aggregation → **P4**
- Manuel olasılık kilidi (`probabilityManual`) → Faz 2
- Multi-currency dönüşüm/gösterim (alan hazır, kur hesabı yok) → roadmap infra
- Teklif/PDF (deal → quote) → **P3**

---

## 7. Sonnet için dokunulacak dosyalar

**Backend (yeni):** `config/deals.js`, `models/Deal.js`, `models/DealEvent.js`, `controllers/dealController.js`, `routes/dealRoutes.js`, `validators/dealValidators.js`
**Backend (düzenle):** `models/Lead.js` (+convertedDeal), `models/LeadEvent.js` (+'converted'), `controllers/leadController.js` (+convert), `routes/leadRoutes.js` (+convert route), `config/permissions.js` (+deals), `server.js` (route mount)
**Frontend (yeni):** `pages/Deals.jsx`, `components/deals/*` (§4.2), `hooks/useDeals.js`, `utils/dealForecast.js`
**Frontend (düzenle):** `config/permissions.js` (mirror), `App.jsx` (route), `components/layout/Sidebar.jsx` (giriş), `components/leads/LeadDetailDrawer.jsx` (+dönüştür butonu/rozet)

**Doğrulama** (hafıza: puppeteer + `admin@microcrm.com`/`admin123`): board render, drag-drop stage değişimi + 409 senaryosu, Lead→Deal dönüşümü (Customer oluşuyor mu), intern'in `/deals`'e sokulmadığı, forecast metriklerinin toplamı.
