/**
 * Walking Skeleton runner — Stage 1. Soyutlama üzerinden TEK bir test faturası
 * "keser" ve HAM cevabı yazdırır. Amaç: akışın uçtan uca çalıştığını görmek
 * (arayüzü hayal etmeden). Mock ile sıfır network çalışır.
 *
 *   INVOICING_PROVIDER=mock node scripts/invoicing-skeleton.js
 *   INVOICING_PROVIDER=mock node scripts/invoicing-skeleton.js invalid_tax   (hata yolu)
 *
 * Faturaport creds/endpoint gelince (backend/.env):
 *   FATURAPORT_ENV=sandbox node scripts/invoicing-skeleton.js   -> gerçek sandbox
 */
require('dotenv').config();
const { randomUUID } = require('crypto');
const { getInvoicingProvider } = require('../services/invoicing');

async function main() {
  const provider = getInvoicingProvider();
  const simulate = process.argv[2]; // opsiyonel: hata yolu denemesi
  console.log('Sağlayıcı:', provider.constructor.name);

  // IDEMPOTENCY anahtarı — aynı referans iki kez fatura KESMEMELİ. Stage 3'te
  // lokal DRAFT kaydına yazılıp gönderim öncesi kontrol edilecek; iskelette üretiyoruz.
  const localReferenceId = `crm-demo-${randomUUID()}`;

  const payload = {
    localReferenceId,
    recipient: {
      name: 'Test Alıcı A.Ş.',
      taxNumber: '1234567801', // örnek VKN (10 hane)
      taxOffice: 'Kadıköy',
      address: 'İstanbul, Türkiye',
    },
    lineItems: [
      { name: 'Web Sitesi Geliştirme', quantity: 1, unitPrice: 45000, vatRate: 20 },
      { name: 'Aylık Bakım & Destek', quantity: 6, unitPrice: 3500, vatRate: 20 },
    ],
    currency: 'TRY',
    notes: 'Walking skeleton test faturası',
    ...(simulate ? { __simulate: simulate } : {}),
  };

  console.log('localReferenceId (idempotency):', localReferenceId, '\n');

  try {
    const result = await provider.issueInvoice(payload);

    console.log('--- SONUÇ (normalized) ---');
    console.log({
      providerInvoiceId: result.providerInvoiceId,
      invoiceNumber: result.invoiceNumber,
      pdfUrl: result.pdfUrl,
      status: result.status, // dikkat: SENDING (senkron POST'a güvenmiyoruz)
    });

    console.log('\n--- HAM CEVAP (raw — reconciliation için saklanacak) ---');
    console.log(JSON.stringify(result.raw, null, 2));

    const status = await provider.getInvoiceStatus(result.providerInvoiceId);
    console.log('\ngetInvoiceStatus →', status, '(gerçekte ISSUED webhook ile kesinleşir)');
  } catch (err) {
    console.error('\n--- DOMAIN HATA (provider hata dili gizlendi) ---');
    console.error(`${err.name}: ${err.message}  [retryable=${err.retryable}]`);
    process.exitCode = 1;
  }
}

main();
