# 🧾 Invoice OCR Service — Smart Invoice & VAT Extraction

Fatura görsellerini yapay zekâ ile işleyerek satır bazlı KDV ayrıştırması yapan bağımsız bir mikroservis.

## 🎯 Ne Yapar?

1. **OCR & AI Parsing**: Fatura görsellerini (JPEG, PNG, PDF) Google Gemini Vision API ile analiz eder
2. **Satır Bazlı KDV Ayrıştırma**: Her kalemi KDV oranına göre ayırır (%1, %10, %20)
3. **Matematiksel Doğrulama**: Hesaplanan toplamı faturadaki toplam ile karşılaştırır (±0.50 TL tolerans)
4. **Toplu İşleme**: Tek seferde 10-20 fatura yükleme ve işleme desteği

## 🏗️ Mimari

Bu modül **tamamen bağımsız** çalışır. Ana CRM projesiyle tek bağı aynı MongoDB veritabanını paylaşmasıdır.

```
invoice-ocr-service/
├── server.js              # Express server (port 5001)
├── config/                # Ortam değişkenleri
├── controllers/           # HTTP endpoint handler'ları
├── services/
│   ├── ocrService.js      # Gemini Vision API entegrasyonu
│   └── parserService.js   # AI çıktı parser'ı
├── utils/
│   ├── vatCalculator.js   # KDV hesaplama motoru (modülün kalbi)
│   ├── validators.js      # Input doğrulama
│   └── constants.js       # TR KDV oranları tablosu
├── models/
│   └── Invoice.js         # MongoDB şeması
├── middleware/             # Upload & error handling
├── routes/                # API route tanımları
└── tests/                 # Jest unit testleri
```

## 🚀 Bağımsız Kurulum

### Gereksinimler
- Node.js v18+
- MongoDB Atlas hesabı
- Google Gemini API Key ([AI Studio](https://aistudio.google.com/apikey)'dan alınabilir)

### Kurulum

```bash
cd invoice-ocr-service

# 1. Bağımlılıkları kur
npm install

# 2. .env dosyasını ayarla
cp .env.example .env
# .env dosyasını düzenle: MONGO_URI ve GEMINI_API_KEY değerlerini gir

# 3. Servisi başlat
npm run dev
```

Servis `http://localhost:5001` üzerinde çalışacak.

### Ana CRM ile Birlikte

```bash
# Proje kökünden tüm servisleri birlikte başlat
npm run dev:all
```

## ⚙️ Ortam Değişkenleri

| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `MONGO_URI` | MongoDB bağlantı URI'si | — |
| `GEMINI_API_KEY` | Google Gemini API anahtarı | — |
| `PORT` | Servis portu | `5001` |
| `NODE_ENV` | Ortam (development/production) | `development` |
| `MAX_FILE_SIZE_MB` | Maksimum dosya boyutu (MB) | `10` |
| `MAX_BULK_FILES` | Tek seferde maks. dosya sayısı | `20` |
| `VAT_TOLERANCE` | KDV doğrulama toleransı (TL) | `0.50` |

## 🔌 API Uç Noktaları

| Method | Endpoint | Açıklama |
|---|---|---|
| `POST` | `/api/invoices/upload` | Tek fatura yükle + işle |
| `POST` | `/api/invoices/bulk-upload` | Toplu fatura yükle (10-20 adet) |
| `GET` | `/api/invoices` | Fatura listesi (pagination + filtre) |
| `GET` | `/api/invoices/stats/summary` | İstatistikler |
| `GET` | `/api/invoices/:id` | Fatura detayı + KDV kırılımı |
| `PUT` | `/api/invoices/:id` | Manuel düzeltme |
| `DELETE` | `/api/invoices/:id` | Fatura sil |
| `GET` | `/api/health` | Servis sağlık kontrolü |

## 🧮 KDV Hesaplama Mantığı

```
Matrah × (KDV Oranı / 100) = KDV Tutarı
Matrah + KDV Tutarı = Kalem Toplamı
Σ Kalem Toplamları = Hesaplanan Genel Toplam
|Hesaplanan - Faturadaki| ≤ 0.50 TL → ✅ Doğrulandı
|Hesaplanan - Faturadaki| > 0.50 TL → ⚠️ Uyuşmazlık
```

## 🧪 Testler

```bash
npm test
```

Testler `vatCalculator.js` içindeki tüm fonksiyonları kapsar:
- `calculateLineVat` — Tek satır KDV hesaplaması
- `buildVatSummary` — KDV grup özetleme
- `crossCheckTotals` — Matematiksel doğrulama
- `validateInvoice` — Tam pipeline testi

## 📄 Lisans

MIT
