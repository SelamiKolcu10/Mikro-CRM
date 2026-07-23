const { randomUUID } = require('crypto');
const InvoicingProvider = require('./InvoicingProvider');
const {
  ValidationError,
  InvalidRecipientTaxNumberError,
  InsufficientCreditError,
  IntegratorUnavailableError,
} = require('./errors');

/**
 * MockInvoicingProvider — SIFIR network. Tüm akış (Controller → Provider) gerçek
 * API olmadan test edilebilsin diye aynı sözleşmeyi uygular. Deterministik sonuç
 * ve HAM-benzeri bir cevap üretir. Hata yollarını denemek için payload'a
 * `__simulate` konabilir: 'invalid_tax' | 'no_credit' | 'validation' | 'down'.
 */
class MockInvoicingProvider extends InvoicingProvider {
  constructor() {
    super();
    this._store = new Map(); // providerInvoiceId -> kayıt (bellekte)
    this._seq = 0;
  }

  async issueInvoice(payload) {
    this._simulateErrors(payload);

    const providerInvoiceId = `mock-ettn-${randomUUID()}`;
    this._seq += 1;
    const invoiceNumber = `GIB${new Date().getFullYear()}${String(this._seq).padStart(9, '0')}`;

    // Sağlayıcının döneceği HAM cevabı taklit et (Faturaport benzeri alan adları).
    const raw = {
      success: true,
      localReferenceId: payload.localReferenceId,
      ettn: providerInvoiceId,
      invoiceNumber,
      documentUrl: `https://sandbox.mock/invoices/${providerInvoiceId}.pdf`,
      status: 'QUEUED',
      receivedAt: new Date().toISOString(),
    };

    // ÖNEMLİ: senkron cevap "kesildi" DEĞİL. status=SENDING; ISSUED gerçekte
    // webhook/poll ile gelir. Mock, sonraki getInvoiceStatus için ISSUED saklar.
    this._store.set(providerInvoiceId, { providerInvoiceId, invoiceNumber, status: 'ISSUED', raw });

    return {
      providerInvoiceId,
      invoiceNumber,
      pdfBase64: null,
      pdfUrl: raw.documentUrl,
      status: 'SENDING',
      raw,
    };
  }

  async getInvoiceStatus(providerInvoiceId) {
    const rec = this._store.get(providerInvoiceId);
    return rec ? rec.status : 'FAILED';
  }

  async getInvoiceRecord(providerInvoiceId) {
    const rec = this._store.get(providerInvoiceId);
    if (!rec) return null;
    // Mock: kesim sonrası "işlendi" say → ISSUED + resmî no hazır.
    return { providerInvoiceId, invoiceNumber: rec.invoiceNumber, status: rec.status, raw: rec.raw };
  }

  async cancelInvoice(providerInvoiceId, reason) {
    const rec = this._store.get(providerInvoiceId);
    if (!rec) throw new ValidationError('İptal edilecek fatura bulunamadı.');
    rec.status = 'CANCELLED';
    return { providerInvoiceId, status: 'CANCELLED', reason };
  }

  handleWebhook(rawPayload) {
    return {
      providerInvoiceId: rawPayload.ettn,
      status: rawPayload.status === 'ACCEPTED' ? 'ISSUED' : 'FAILED',
      raw: rawPayload,
    };
  }

  _simulateErrors(payload) {
    switch (payload.__simulate) {
      case 'invalid_tax': throw new InvalidRecipientTaxNumberError();
      case 'no_credit': throw new InsufficientCreditError();
      case 'validation': throw new ValidationError('Zorunlu alan eksik (mock).');
      case 'down': throw new IntegratorUnavailableError();
      default: break;
    }
  }
}

module.exports = MockInvoicingProvider;
