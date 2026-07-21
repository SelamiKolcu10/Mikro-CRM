# Micro CRM — Tasarım Sistemi v2 "Operations Console"

Tarih: 2026-07-19 · Durum: **Onay bekliyor** · Kapsam: tüm frontend (staff + portal)
Sabit kısıt: **Sidebar solda kalır** (beyaz yüzey). Yerleşim iskeletleri korunur; görsel dil, veri sunumu ve hareket katmanı yenilenir.

---

## 1. Kimlik & İlkeler

**Tavır:** Operasyon konsolu — Linear/Stripe soyundan. Sakin, yoğun, güven veren.
Canlı önizleme: `tasarim-onizleme` Artifact'ı (onay kapısı budur).

1. **Renk = anlam.** Tek marka aksanı (derin mavi `#0b5fcc`): aksiyon, aktif durum, odak. Yeşil/amber/kırmızı yalnızca durum bildirir. Dekoratif renk yok.
2. **Işık ayrıştırır, çizgi değil.** Cam efekti (backdrop-blur) tamamen kalkar; katmanlar tek ince gölge skalası + hairline border ile ayrışır.
3. **Veri en yüksek sesli öğedir.** Chrome (eksen, grid, başlık) sessizleşir; sayı ve mark öne çıkar.
4. **Açık tema imzadır, koyu tema eşit vatandaştır.** Her token çifti iki modda da tanımlı ve test edilmiştir.
5. **Emoji ikon olamaz.** 24 dosyadaki 57 emoji → Heroicons (`react-icons/hi2`, outline, 1.5 stroke). Tek ikon ailesi, tek boyut token'ı (16/20/24).

## 2. Renk Token'ları

Mevcut `index.css` değişken adları **korunur** (bileşenlere dokunmadan yayılım) — yalnızca değerler ve birkaç ek:

| Rol | Açık (imza) | Koyu |
|---|---|---|
| `--bg-primary` (tuval) | `#f6f8fb` | `#0a0f1a` (mor-siyah yerine mavi-siyah) |
| `--bg-card` / yüzey | `#ffffff` | `#101827` |
| `--text-primary` | `#0f172a` | `#e8edf5` |
| `--text-secondary` | `#475569` | `#94a3b8` |
| `--accent-primary` | `#0b5fcc` | `#3987e5` (koyu yüzeyde adımlanmış) |
| `--border-color` | `#e5eaf1` | `rgba(255,255,255,.07)` |
| success / warning / danger | `#0f9d6b` / `#b45309` / `#d63b3b` | `#34d399` / `#fbbf24` / `#f87171` |

- Gölge skalası: `sm` 0 1px 2px · `md` 0 4px 12px · `lg` 0 12px 32px — hepsi `rgba(15,23,42,α)` (mor glow'lar kalktı).
- Plan chip'leri (ordinal tier): free `slate` · starter `#1baf7a` · premium `#0b5fcc` · vip `#b45309/amber`. Tip rozetleri: bug `danger` · feature `accent` · improvement `aqua`.

## 3. Tipografi

| Rol | Yüz | Kullanım |
|---|---|---|
| Display/başlık | **Archivo** (600/700, `-0.02em`) | h1–h3, sayfa başlıkları, kart başlıkları, hero sayılar |
| Gövde | **Inter** (400/500/600) | mevcut — değişmez |
| Veri/mono | **JetBrains Mono** (400/500) | tablo sayı sütunları, kod, ID'ler (mevcut import) |

- Ölçek mevcut token'larla; ek: `--font-size-hero: 2.6rem` (dashboard hero sayısı).
- Sayı kuralı: kolonlarda `tabular-nums`; büyük tek sayılarda (hero/stat) proportional.

## 4. Sidebar (solda, beyaz — içerik yenilenir)

- **Marka satırı:** mavi gradient `μ` mark + "Micro CRM" (mevcut), altına ince ayraç.
- **Gruplar:** mevcut navigation.js yapısı kalır; grup etiketi 11px/uppercase/`letter-spacing .08em`.
- **Aktif öğe:** `--accent-soft` (%8 mavi) dolgu + sol 3px mavi ray + ikon aksan renginde. Hover: nötr `--bg-hover`.
- **Rozetler:** sayısal bildirimler `--accent`; eskalasyon `danger` (mevcut mantık).
- **Alt bölge (yeni):** tam-genişlik tema butonu yerine **kullanıcı kartı** — avatar (baş harf, deterministik renk), isim + rol etiketi, sağda ikon-buton tema toggle'ı. Tek satır, sessiz.

## 5. Veri Görselleştirme Dili (dataviz skill parametreleri)

Kategorik palet **validator'dan geçti** (açık: beyaz yüzey, koyu: `#111827`; CVD ΔE ≥ 8.4, normal ≥ 19.3):

| Slot | Açık | Koyu | | Slot | Açık | Koyu |
|---|---|---|---|---|---|---|
| 1 mavi (marka) | `#0b5fcc` | `#3987e5` | | 4 amber | `#eda100` | `#c98500` |
| 2 yeşil | `#008300` | `#008300` | | 5 aqua | `#1baf7a` | `#199e70` |
| 3 magenta | `#e87ba4` | `#d55181` | | 6 turuncu | `#eb6834` | `#d95926` |

Kurallar (özet — kaynak: dataviz skill):
- **Sıra sabittir, döndürülmez.** Renk varlığı izler (Premium her grafikte aynı mavi). 4+ seride "Diğer"e katla.
- **Sequential = tek hue mavi** (ısı haritası: mevcut TaskHeatmap bu ramp'a geçer). Diverging = mavi↔kırmızı, gri orta.
- **Mark spec:** bar ≤24px, 4px yuvarlak veri-ucu (taban düz); çizgi 2px; alan dolgusu %10 opaklık; grid hairline, kesiksiz, tek adım gri. Bitişik marklar arasında 2px yüzey boşluğu.
- **Işık modu relief kuralı:** magenta/amber/aqua yüzeyde <3:1 → değer **her zaman doğrudan etiketlenir** (mevcut bar-chart zaten yapıyor, korunur).
- **Hover katmanı varsayılan:** çizgi/alan → crosshair + tooltip; bar/hücre → mark-hover tooltip. Tooltip: beyaz yüzey, hairline, `shadow-md`.
- **Stat kartı sözleşmesi:** etiket → değer (Archivo semibold, auto-compact: 12.9K/$4.2M) → delta (yön × iyi/kötü rengi, ok ikonu) → 12-nokta sparkline (de-emphasis mavi, son nokta aksan).
- Legend ≥2 seri; metin asla seri rengini giymez (yanına renk noktası konur).

## 6. Bileşen Dili

- **Kart:** beyaz, `--radius-lg`, hairline border, `shadow-sm`; hover'da `shadow-md` + border koyulaşır (transform yok — layout oynamaz).
- **Tablo:** başlık satırı sticky, 12px uppercase muted; satır hover `--bg-hover`; sayı kolonları sağa dayalı mono; satır yüksekliği 48px; boş durum = illüstratif ikon değil, **hayalet satır iskeleti + tek satır metin + eylem**.
- **Chip/rozet:** mevcut kapsül dili (`radius-full`, `-soft` zemin + tam renk metin) korunur — Proje modülünün "Kapsül & Halka" kuralı uygulama geneline terfi eder.
- **Buton hiyerarşisi:** primary (dolu mavi) · secondary (beyaz + border) · ghost (şeffaf) · destructive (kırmızı, ayrık konum). Focus: 2px mavi ring + 2px offset, her etkileşimlide.
- **Form:** görünür label (placeholder-only yasak), hata alan altında + `role="alert"`, submit'te spinner + disable.
- **Yükleme:** spinner yerine **skeleton/shimmer** (kart, tablo satırı, chart iskeleti). >1sn her yüzeyde.
- **Modal/Drawer:** mevcut davranış; blur yalnızca modal scrim'de kalır (işlevsel), dozu düşer.

## 7. Hareket & Sayfa Geçişleri

Kütüphane yok — CSS + mevcut transition token'ları:

- **Route geçişi:** içerik `opacity 0→1` + `translateY(6px)→0`, 220ms ease-out; çocuklar (stat kartları, tablo blokları) 40ms stagger. Çıkış girişten kısa (~140ms). Uygulama: `Layout` içinde pathname-key'li wrapper, saf CSS animasyon.
- **Grafik girişi:** bar/alan tek sefer draw-in (`--transition-slow`), ring `stroke-dashoffset` (mevcut).
- **Micro:** buton press `scale(.97)`; kart hover gölge geçişi; sidebar aktif ray'i 150ms kayar.
- **`prefers-reduced-motion`: hepsi kapanır**, grafikler anında çizili.

## 8. Sayfa Tretmanları (özet)

| Sayfa | Ana müdahale |
|---|---|
| Dashboard | Hero sayı (MRR) + delta'lı 4 stat kartı (sparkline'lı) · MRR alan grafiği (crosshair) · plan donut (merkez toplam) · öncelik barları · top-feedback listesi rank kapsülleriyle |
| Customers | Pro tablo tretmanı; avatar+isim hücresi, plan chip, MRR mono sağa dayalı, satır aksiyonları hover'da |
| Feedbacks | Filtre chip barı; öncelik/durum kapsülleri; gelir etkisi vurgulu kolon |
| Tasks | Kanban kolon başlıkları sayaç chip'li; kart tretmanı; heatmap → sequential mavi ramp |
| Projects | Mevcut "Kapsül & Halka" dili korunur, mavi palete geçer |
| Invoices/Spending | Stat şeridi + dataviz dili (kategori barları, aylık trend alanı); uploader dropzone tretmanı |
| ChatDashboard | Konuşma listesi yoğun satır tretmanı; SLA chip'leri status paletiyle |
| AuditLog | Timeline dikey rayı hairline; olay tipleri ikon+kapsül; zincir durumu status diliyle |
| UserManagement | Kart/ağaç görünümü; ContributionRing mavi ramp |
| AccessControl/Approvals | Matris hücreleri status dili; onay kuyruğu satır tretmanı |
| Login/ForcePassword | Önizlemedeki rafine kart (mavi parıltı, tek aksan) |
| Portal (3 sayfa) | Aynı token seti; müşteri markası satırı; sadeleştirilmiş nav |

## 9. Uygulama Planı

1. **Faz 1 — Temel:** token değerleri + Archivo import + gölge/border revizyonu + cam efekti temizliği (`index.css`).
2. **Faz 2 — Emoji → ikon:** 24 dosya, mekanik değişim.
3. **Faz 3 — Çekirdek bileşenler:** stat kartı (sparkline), chart primitifleri (alan/donut/bar, SVG), skeleton'lar, tablo tretmanı.
4. **Faz 4 — Sayfa geçişleri + micro-motion.**
5. **Faz 5 — Sayfa sayfa tretman** (tablo sırası: Dashboard → Customers → Tasks → gerisi).

**Kapsam dışı:** yerleşim/iskelet değişikliği, sidebar'ın yeri, yeni kütüphane (chart/animasyon), backend, navigation.js yapısı.
