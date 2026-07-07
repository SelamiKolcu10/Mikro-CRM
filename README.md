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
├── invoice-ocr-service/        # 🧾 Bağımsız Fatura OCR Mikroservisi
│   ├── services/               # Gemini AI & OCR entegrasyonu
│   ├── utils/                  # KDV hesaplama motoru
│   ├── models/                 # Fatura veri modeli
│   ├── controllers/            # API handler'ları
│   ├── tests/                  # Jest unit testleri
│   └── README.md               # Bağımsız kurulum kılavuzu
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

### Invoices (Fatura — Bağımsız Servis, Port 5001)
| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/invoices/upload` | Tek fatura yükle + AI ile işle |
| POST | `/api/invoices/bulk-upload` | Toplu fatura yükle (10-20 adet) |
| GET | `/api/invoices` | Fatura listesi (pagination + filtre) |
| GET | `/api/invoices/:id` | Fatura detayı + KDV kırılımı |
| PUT | `/api/invoices/:id` | Manuel düzeltme |
| DELETE | `/api/invoices/:id` | Fatura sil |
| GET | `/api/invoices/stats/summary` | İşleme istatistikleri |

### Kritik İlişki
`Feedback.revenueImpact` ve `Feedback.priority` alanları, bağlı müşterinin `mrr` değerinden **otomatik hesaplanır**. Müşterinin planı değiştiğinde, ilişkili tüm geri bildirimler de güncellenir.

## 🔄 Değişiklik Geçmişi (Changelog)

Projeye eklenen yeni özellikler, güncellemeler ve hata düzeltmeleri burada listelenecektir.

- **2026-07-06** — 💬 **Müşteri Satırından Hızlı Geri Bildirim** eklendi (v1.1.1)
  - Müşteriler (Customers) sayfasındaki tabloya, her müşteri için "Geri Bildirim Ekle" kısayol butonu eklendi.
  - Tıklandığında o müşterinin bilgileri otomatik olarak yüklenmiş şekilde Geri Bildirim oluşturma modalı açılıyor.
- **2026-07-06** — 🧾 **Akıllı Fatura ve KDV Ayrıştırma Modülü** eklendi (v1.1.0)
  - Bağımsız `invoice-ocr-service/` mikroservisi oluşturuldu (port 5001)
  - Google Gemini Vision API ile fatura OCR entegrasyonu
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
