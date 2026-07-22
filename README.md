# 🎯 Micro-SaaS CRM — Revenue-Driven Feedback Prioritization

SaaS ürün ekipleri için müşteri geri bildirimlerini **gelir etkisine göre önceliklendiren** hafif bir CRM paneli.

## 📋 Ne İşe Yarar?

Bir SaaS ürünü geliştirirken, farklı kanallardan (Twitter, Discord, E-posta, Uygulama İçi) gelen müşteri geri bildirimlerini toplarsınız. Bu CRM, her geri bildirimin arkasındaki **müşterinin ödeme planını ve aylık gelirini (MRR)** göstererek hangi hatanın/isteğin önce çözülmesi gerektiğini veri odaklı bir şekilde belirlemenize yardımcı olur.

**Temel mantık:** VIP müşterinin kritik hatası > Free kullanıcının kozmetik isteği

## 🛠️ Teknoloji Stack

| Katman | Teknoloji |
|---|---|
| Frontend | React 19 (Vite) |
| State | Context API |
| Backend | Node.js + Express |
| Veritabanı | MongoDB Atlas |
| Auth | JWT (JSON Web Token) |
| Dil | İki dilli (Türkçe / İngilizce) |
| Tema | Dark Mode |

## 🚀 Hızlı Başlangıç

### Gereksinimler
- Node.js v18+
- MongoDB Atlas hesabı (veya yerel MongoDB)

### Kurulum

```bash
# 1. Repoyu klonla
git clone <repo-url>
cd Micro-CRM

# 2. Tüm bağımlılıkları kur
npm run install-all

# 3. .env dosyasını ayarla
cp .env.example backend/.env
# backend/.env dosyasını düzenle: MONGO_URI ve JWT_SECRET değerlerini gir

# 4. Demo verisini yükle (opsiyonel ama önerilen)
npm run seed

# 5. Geliştirme sunucularını başlat
npm run dev
```

Uygulama şu adreslerde çalışacak:
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000

### Demo Giriş Bilgileri
- **E-posta:** admin@microcrm.com
- **Şifre:** admin123

## 📁 Proje Yapısı

```
Micro-CRM/
├── frontend/                   # 🖥️ React Frontend (Vite)
│   ├── src/
│   │   ├── components/         # Yeniden kullanılabilir bileşenler
│   │   ├── context/            # Auth & Language Context
│   │   ├── i18n/               # Çeviri dosyaları (tr.json, en.json)
│   │   ├── pages/              # Sayfa bileşenleri
│   │   ├── services/           # API servisleri (Axios)
│   │   └── index.css           # Design System (Dark Mode)
│
├── backend/                    # ⚙️ Express Backend (Node.js)
│   ├── config/                 # DB bağlantısı
│   ├── controllers/            # İş mantığı
│   ├── middleware/              # Auth & Error handling
│   ├── models/                 # Mongoose şemaları
│   ├── routes/                 # API route tanımları
│   ├── seed/                   # Demo veri scripti
│   └── utils/                  # Yardımcı fonksiyonlar
│
├── invoice-ocr-service/        # 🧾 Bağımsız Fatura OCR Mikroservisi (v1)
│   ├── services/               # OpenAI GPT-4o-mini & OCR entegrasyonu
│   ├── utils/                  # KDV hesaplama motoru
│   ├── models/                 # Fatura veri modeli
│   ├── controllers/            # API handler'ları
│   ├── tests/                  # Jest unit testleri
│   └── README.md               # Bağımsız kurulum kılavuzu
│
├── invoice-ocr-v2/              # 🧾 Yerli OCR Fatura Mikroservisi (v2, port 5002)
│   ├── services/                # Tesseract.js OCR + Sharp ön-işleme + regex parser
│   ├── utils/                   # KDV hesaplama motoru (v1 ile aynı)
│   ├── models/                  # Fatura veri modeli
│   ├── controllers/             # API handler'ları (v1 ile aynı interface)
│   ├── tests/                   # Jest unit testleri
│   └── README.md                # Bağımsız kurulum kılavuzu
```

## 🔌 API Uç Noktaları

### Auth
| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/auth/register` | Yeni kullanıcı kaydı |
| POST | `/api/auth/login` | Giriş yap → JWT token |
| GET | `/api/auth/me` | Mevcut kullanıcı bilgisi |

### Customers
| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/api/customers` | Müşteri listesi (pagination + filtre) |
| GET | `/api/customers/:id` | Müşteri detayı + geri bildirimleri |
| POST | `/api/customers` | Yeni müşteri ekle |
| PUT | `/api/customers/:id` | Müşteri güncelle |
| DELETE | `/api/customers/:id` | Müşteri sil (cascade) |

### Feedbacks
| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/api/feedbacks` | Geri bildirimler (revenueImpact'e göre ↓) |
| GET | `/api/feedbacks/:id` | Geri bildirim detayı |
| POST | `/api/feedbacks` | Yeni geri bildirim (otomatik öncelik) |
| PUT | `/api/feedbacks/:id` | Güncelle |
| DELETE | `/api/feedbacks/:id` | Sil |
| GET | `/api/feedbacks/stats/summary` | Dashboard istatistikleri |

## 🏗️ Veri Modeli

### Customer (Müşteri)
```javascript
{
  name: String,          // Müşteri adı
  email: String,         // E-posta (unique)
  company: String,       // Şirket adı
  plan: 'free' | 'starter' | 'premium' | 'vip',
  mrr: Number,           // Aylık gelir ($)
  source: 'twitter' | 'discord' | 'email' | 'in-app' | 'other'
}
```

### Feedback (Geri Bildirim)
```javascript
{
  title: String,
  description: String,
  type: 'bug' | 'feature' | 'improvement',
  status: 'open' | 'in-progress' | 'resolved' | 'closed',
  priority: 'low' | 'medium' | 'high' | 'critical',  // Otomatik
  revenueImpact: Number,   // Müşterinin MRR'ından otomatik
  customer: ObjectId → Customer
}
```

### Invoices v1 (Fatura — Bağımsız Servis, Port 5001, OpenAI)

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/invoices/upload` | Tek fatura yükle + AI ile işle |
| POST | `/api/invoices/bulk-upload` | Toplu fatura yükle (10-20 adet) |
| GET | `/api/invoices` | Fatura listesi (pagination + filtre) |
| GET | `/api/invoices/:id` | Fatura detayı + KDV kırılımı |
| PUT | `/api/invoices/:id` | Manuel düzeltme |
| DELETE | `/api/invoices/:id` | Fatura sil |
| GET | `/api/invoices/stats/summary` | İşleme istatistikleri |

### Invoices v2 (Fatura — Bağımsız Servis, Port 5002, Yerli OCR/Tesseract.js)

Aynı endpoint seti, `invoice-ocr-v2/` üzerinden `http://localhost:5002/api` adresinde. Dış API bağımlılığı yoktur, `invoicesv2` koleksiyonunu kullanır. Detaylar için [invoice-ocr-v2/README.md](invoice-ocr-v2/README.md).

### Kritik İlişki
`Feedback.revenueImpact` ve `Feedback.priority` alanları, bağlı müşterinin `mrr` değerinden **otomatik hesaplanır**. Müşterinin planı değiştiğinde, ilişkili tüm geri bildirimler de güncellenir.

## 🔄 Değişiklik Geçmişi (Changelog)

- **2026-07-22** — 📜 **Teklif Motoru & Onay Akışı & Satış Faturası Entegrasyonu (P3a & P3b)** eklendi (v1.5.0)
  - **Ürün Kataloğu (Catalog):** SKU, birim, birim fiyat, KDV oranı (%0, %1, %10, %20), stok miktarı yönetimi.
  - **Teklif Motoru (Quote Engine):** İki kademeli kalemsel ve teklif geneli indirim (yüzde / tutar), otomatik KDV ve genel toplam hesabı, atomik sıralı numara üretimi (`TEK-2026-XXXX`).
  - **PDF Üretim Engine (Puppeteer):** Chrome headless ile kurumsal antetli, profesyonel HTML/CSS şablonlu vector PDF üretimi (`GET /api/quotes/:id/pdf`).
  - **Müşteri Dış Onay / Ret Sayfası (Public Token):** Kimlik doğrulamasız, token tabanlı müşteri teklif inceleme ve onay/ret portalı (`/q/:token`). `publicQuoteRateLimiter` ile güvenlik önlemi.
  - **Onay / Revizyon Akışı & Socket.io Bildirimleri:** `QuoteEvent` audit kaydı, revizyon versiyonlama (`v1`, `v2`, ...), teklif incelendiğinde veya onaylandığında `STAFF_ROOM` socket yayını.
  - **Satış Faturası Köprüsü (Invoice Bridge):** Onaylanan tekliflerin tek tıkla satış faturasına dönüştürülmesi (`FTR-2026-XXXX`), fatura durum takibi (taslak, kesildi, ödendi, vadesi geçti, iptal) ve PDF indirme.
  - **Müşteri Zaman Çizelgesi (Customer Timeline) Entegrasyonu:** Teklif ve fatura yaşam döngüsü olaylarının müşteri zaman çizelgesine anlık harmanlanması.
- **2026-07-13** — 📊 **GitHub-Style Contribution Heatmap** eklendi
  - Görev sayfasının altına 365 günlük GitHub tarzı katkı ısı haritası (contribution calendar) eklendi
  - 7×53 hafta/gün grid düzeni, ay etiketleri, haftanın günü etiketleri (Mon/Wed/Fri)
  - Yeşil renk gradyanı (`#0e4429` → `#39d353`) ile karanlık tema uyumu
  - Hover tooltip: Glassmorphism efektli, zaman damgalı aksiyon detayları (kim, ne yaptı, hangi görev)
  - Çok seviyeli filtreleme: Tüm Departmanlar (global), Departman bazlı, Kişi bazlı görünüm
  - Sayfa filtrelerini (departman/üye) dinleyerek anlık güncelleme
  - TaskActivity modeli zenginleştirildi: `changedByName`, `taskTitle`, `action` alanları eklendi
  - Backend API: `$facet` ile tek sorgu, sözlük (dictionary) formatında ön-toplanmış veri
  - Görev oluşturma artık TaskActivity kaydı oluşturuyor (sadece durum değişikliği değil)
  - Seed data: ~180 günlük demo TaskActivity verisi
  - Türkçe/İngilizce i18n desteği (ay adları, gün etiketleri, tooltip metinleri)
  - Responsive tasarım: Dar ekranlarda yatay kaydırma
- **2026-07-08** — 🧾 **Fatura v2 — Yerli OCR Mikroservisi** eklendi (v1.3.0)
  - Bağımsız `invoice-ocr-v2/` mikroservisi oluşturuldu (port 5002), v1'e dokunulmadı
  - Tesseract.js ile tamamen yerel OCR — dış API bağımlılığı ve maliyet sıfır
  - Sharp ile görüntü ön-işleme pipeline'ı (grayscale, kontrast, keskinleştirme, eşikleme)
  - Kendi Türkçe fatura regex pattern engine'i (`invoiceParser.js`)
  - v1 ile birebir aynı KDV motoru, doğrulama ve API interface'i yeniden kullanıldı
  - Ayrı `invoicesv2` MongoDB koleksiyonu
  - Frontend: `/invoices-v2` sayfası, Sidebar'a "Fatura v2 (Yerli OCR)" menü öğesi
  - Türkçe/İngilizce i18n desteği
  - 44 Jest unit testi (vatCalculator + invoiceParser)
- **2026-07-07** — 🔄 **AI Motor Değişikliği: Google Gemini → OpenAI GPT-4o-mini** (v1.2.0)
  - Fatura OCR altyapısı Google Gemini Vision API'den **OpenAI GPT-4o-mini Vision**'a geçirildi
  - Daha güvenilir ve düşük maliyetli fatura okuma deneyimi
  - `@google/generative-ai` paketi kaldırılıp `openai` paketi eklendi
  - `.env` yapılandırması `GEMINI_API_KEY` → `OPENAI_API_KEY` olarak güncellendi
- **2026-07-06** — 💬 **Müşteri Satırından Hızlı Geri Bildirim** eklendi (v1.1.1)
  - Müşteriler (Customers) sayfasındaki tabloya, her müşteri için "Geri Bildirim Ekle" kısayol butonu eklendi.
  - Tıklandığında o müşterinin bilgileri otomatik olarak yüklenmiş şekilde Geri Bildirim oluşturma modalı açılıyor.
- **2026-07-06** — 🧾 **Akıllı Fatura ve KDV Ayrıştırma Modülü** eklendi (v1.1.0)
  - Bağımsız `invoice-ocr-service/` mikroservisi oluşturuldu (port 5001)
  - OpenAI GPT-4o-mini Vision API ile fatura OCR entegrasyonu
  - Satır bazlı KDV ayrıştırma ve matematiksel doğrulama motoru
  - Toplu fatura yükleme desteği (10-20 adet)
  - Frontend: Drag & drop upload, fatura tablosu, KDV detay modalı
  - Türkiye KDV oranları desteği (%1, %10, %20)
  - Jest unit testleri (vatCalculator)
  - Türkçe/İngilizce i18n desteği
  - Sidebar'a "Finans" bölümü eklendi
- **[Tarih Eklenecek]** - İlk versiyon (v1.0.0) yayınlandı.

## 📄 Lisans

MIT
