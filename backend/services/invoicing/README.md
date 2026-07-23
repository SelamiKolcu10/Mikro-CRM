# Invoicing Adapter (Türkiye e-Fatura / e-Arşiv)

İzole, swappable e-fatura kesim katmanı. Sağlayıcıya özel HER ŞEY tek dosyada
(`FaturaportProvider.js`); Controller/UI hangi sağlayıcının kullanıldığını bilmez.
Amaç bağımsızlık değil **izolasyon** — sağlayıcı değişince (Paraşüt/Uyumsoft/Logo)
yalnız bir dosya değişir.

## Katmanlar
```
React UI → Controller → InvoicingProvider (sözleşme) → FaturaportProvider → Faturaport REST API
                                    └→ MockInvoicingProvider (sıfır network, test)
```

## Dosyalar
| Dosya | Sorumluluk |
|---|---|
| `InvoicingProvider.js` | Soyut sözleşme + tip tanımları (issue/status/cancel/webhook) |
| `MockInvoicingProvider.js` | Sıfır-network sahte sağlayıcı (tüm akış API'siz test edilir) |
| `FaturaportProvider.js` | Faturaport'a özel: auth, endpoint, payload şekli, hata eşleme (**TODO'lar dolacak**) |
| `tokenCache.js` | Concurrency-safe Bearer token cache (expiry'den 60sn önce yenile, single-flight kilit) |
| `errors.js` | Domain hataları — provider'ın hata dilini gizler |
| `index.js` | DI seçici (`getInvoicingProvider()`), env'e göre implementasyon |

## Durum: Stage 1 (Walking Skeleton) TAMAM
- ✅ Sözleşme + Mock + domain hatalar + token-cache + DI + hata eşleme iskeleti
- ✅ Uçtan uca çalışıyor (mock): `node scripts/invoicing-skeleton.js`
- ⏳ `FaturaportProvider` içindeki `TODO(faturaport)` satırları gerçek prodapi
  dokümanı + sandbox creds gelince doldurulacak.
- ⛔ Henüz YOK (Stage 3): webhook endpoint, lokal DRAFT→SENDING→ISSUED/FAILED
  state machine + Mongoose kaydı, idempotency persist, kontör sorgu, poll.

## Çalıştırma
```bash
cd backend
INVOICING_PROVIDER=mock node scripts/invoicing-skeleton.js            # başarı
INVOICING_PROVIDER=mock node scripts/invoicing-skeleton.js invalid_tax # hata yolu
FATURAPORT_ENV=sandbox node scripts/invoicing-skeleton.js             # gerçek (creds gelince)
```

## Ortam değişkenleri (`backend/.env`)
> Secret'ları koda/sohbete YAZMA — yalnız `.env`'e. `.env` git'e girmemeli.
```dotenv
# Sağlayıcı seçimi: mock (varsayılan) | faturaport
INVOICING_PROVIDER=mock

# Faturaport (swagger V3'e göre — creds/endpoint gelince doldur):
FATURAPORT_ENV=sandbox                 # sandbox | production
FATURAPORT_BASE_URL=                   # sandbox base URL (swagger'da server yok, dokümandan)
FATURAPORT_COMPANY_CODE=               # getapitoken body: company_code
FATURAPORT_CLIENT_ID=                  # getapitoken body: client_id
FATURAPORT_CLIENT_SECRET=              # getapitoken body: client_secret
FATURAPORT_INVOICE_PREFIX_ID=          # fatura serisi (uuid) — add-invoice ZORUNLU
# Opsiyonel varsayılanlar:
FATURAPORT_DEFAULT_PROFILE=EARSIVFATURA  # alıcı e-fatura mükellefiyse TEMELFATURA/TICARIFATURA
FATURAPORT_DEFAULT_UNIT_ID=1             # /units listesinden Adet id'si
```

### Swagger V3'ün ortaya çıkardığı gerçekler (kod bunlara göre)
- **İdempotency alanı yok** → çift-fatura koruması lokal (CRM `Invoice`) tarafında, Stage 3.
- **Webhook yok** → ISSUED onayı `get-outgoing-invoice-list` **poll** ile (`getInvoiceRecord`).
- **Token TTL cevapta yok** → JWT `exp` claim'inden okunur.
- **Resmî fatura no** add-invoice cevabında yok (yalnız `invoiceId`/ETTN); poll'da oluşur.
- **PDF** add-invoice cevabında **base64** (`data`) gelir; ayrıca `get-invoice-pdf/{id}`.
- **İptal ucu yok** → `cancelInvoice` desteklenmiyor (panel/başka akış).
- Toplamlar istemci-taraflı hesaplanıp gönderilir (`computeLine` yeniden kullanıldı).
- KDV oranı → `KDV_0/1/10/20`; e-Arşiv vs e-Fatura `check-customer-einvoice-info` ile.

## Kesin kural: fatura ne zaman "ISSUED"?
`issueInvoice` senkron cevabı `status: 'SENDING'` döner — GİB kabulünün kanıtı
DEĞİLDİR. `ISSUED`'a geçiş yalnız webhook/poll ile (Stage 3). Senkron POST'a
asla güvenme.
