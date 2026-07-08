# 🧾 Invoice OCR v2 — Yerli OCR Fatura Servisi (Tesseract.js)

Fatura görsellerini **tamamen yerel** olarak (dış AI/API bağımlılığı olmadan) Tesseract.js OCR motoru ve kendi regex pattern engine'imizle işleyen bağımsız bir mikroservis. `invoice-ocr-service` (v1, OpenAI tabanlı) ile yan yana, birbirine dokunmadan çalışır.

## 🎯 Ne Yapar?

1. **Görüntü Ön-İşleme**: Sharp ile grayscale + kontrast + keskinleştirme + eşikleme
2. **Yerel OCR**: Tesseract.js ile Türkçe metin çıkarımı — internet/API key gerekmez
3. **Regex Pattern Engine**: Türkçe fatura kalıplarını (VKN, fatura no, KDV, toplam vb.) regex ile ayrıştırır
4. **Matematiksel Doğrulama**: v1 ile birebir aynı `vatCalculator` motoru — hesaplanan toplamı faturadaki toplamla karşılaştırır (±0.50 TL tolerans)
5. **Toplu İşleme**: Tek seferde 10-20 fatura yükleme ve sıralı işleme desteği

## 🏗️ Mimari

Bu modül **tamamen bağımsız** çalışır. v1 ile tek ortak noktası MongoDB'yi paylaşabilmesidir (ayrı `invoicesv2` koleksiyonu kullanır).

```
invoice-ocr-v2/
├── server.js                  # Express server (port 5002)
├── config/                    # Ortam değişkenleri
├── controllers/                # HTTP endpoint handler'ları (v1 ile aynı interface)
├── services/
│   ├── imagePreprocessor.js   # Sharp görüntü ön-işleme pipeline'ı
│   ├── ocrService.js          # Tesseract.js entegrasyonu
│   └── invoiceParser.js       # Türkçe fatura regex pattern engine ⭐
├── utils/
│   ├── vatCalculator.js       # KDV hesaplama motoru (v1'den birebir)
│   ├── validators.js          # Input doğrulama
│   └── constants.js           # TR KDV oranları tablosu
├── models/
│   └── Invoice.js             # MongoDB şeması (+ ocrEngine alanı)
├── middleware/                 # Upload & error handling
├── routes/                    # API route tanımları
└── tests/                     # Jest unit testleri
```

## 🚀 Bağımsız Kurulum

### Gereksinimler
- Node.js v18+
- MongoDB Atlas hesabı (veya v1 ile aynı bağlantı)
- **Dış API key gerekmez** — Tesseract Türkçe dil paketi (~4MB) ilk çalıştırmada otomatik indirilip cache'lenir, sonraki çalıştırmalar offline çalışır

### Kurulum

```bash
cd invoice-ocr-v2

# 1. Bağımlılıkları kur
npm install

# 2. .env dosyasını ayarla
cp .env.example .env
# .env dosyasını düzenle: MONGO_URI değerini gir

# 3. Servisi başlat
npm run dev
```

Servis `http://localhost:5002` üzerinde çalışacak.

### Ana CRM ile Birlikte

```bash
# Proje kökünden tüm servisleri (v1 + v2 dahil) birlikte başlat
npm run dev:all
```

## ⚙️ Ortam Değişkenleri

| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `MONGO_URI` | MongoDB bağlantı URI'si | — |
| `PORT` | Servis portu | `5002` |
| `NODE_ENV` | Ortam (development/production) | `development` |
| `OCR_LANGUAGE` | Tesseract dil kodu | `tur` |
| `MAX_FILE_SIZE_MB` | Maksimum dosya boyutu (MB) | `10` |
| `MAX_BULK_FILES` | Tek seferde maks. dosya sayısı | `20` |
| `VAT_TOLERANCE` | KDV doğrulama toleransı (TL) | `30.00` |

## 🔌 API Uç Noktaları

v1 ile **birebir aynı interface** — frontend aynı bileşenleri kullanabilir.

| Method | Endpoint | Açıklama |
|---|---|---|
| `POST` | `/api/invoices/upload` | Tek fatura yükle + Tesseract OCR ile işle |
| `POST` | `/api/invoices/bulk-upload` | Toplu fatura yükle (10-20 adet) |
| `GET` | `/api/invoices` | Fatura listesi (pagination + filtre) |
| `GET` | `/api/invoices/stats/summary` | İstatistikler |
| `GET` | `/api/invoices/:id` | Fatura detayı + KDV kırılımı |
| `PUT` | `/api/invoices/:id` | Manuel düzeltme |
| `DELETE` | `/api/invoices/:id` | Fatura sil |
| `GET` | `/api/health` | Servis sağlık kontrolü |

## 🔍 Regex Pattern Engine

`invoiceParser.js`, Tesseract'tan gelen ham metni satır satır tarayıp bilinen Türkçe fatura kalıplarıyla eşleştirir: VKN, fatura no, tarih, genel toplam, matrah, KDV tutarı ve tablo formatındaki satır kalemleri. AI kullanmadığı için sonuç kalitesi OCR çıktısının netliğine ve fatura formatının kalıplara ne kadar uyduğuna bağlıdır — bu yüzden `confidenceScore` alanı düşükse manuel kontrol önerilir.

## 🧪 Testler

```bash
npm test
```

44 test, iki dosyada:
- `vatCalculator.test.js` — v1 ile aynı KDV motoru testleri
- `invoiceParser.test.js` — Regex pattern engine testleri (VKN, toplam formatları, Türkçe sayı formatı, tarih parse, satır kalemi ayıklama)

## 📄 Lisans

MIT
