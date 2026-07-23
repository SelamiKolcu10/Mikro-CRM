/**
 * InvoicingProvider — soyut sözleşme (interface). Controller SADECE bu tipe
 * bağımlıdır; hangi sağlayıcının (Faturaport/Mock) kullanıldığını asla bilmez.
 * Yeni sağlayıcıya geçmek = yeni bir implementasyon + DI seçimi (index.js);
 * Controller/UI'da tek satır değişmez.
 *
 * @typedef {Object} InvoiceLineItem
 * @property {string} name
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} vatRate            // KDV yüzdesi
 * @property {number} [discountRate]
 *
 * @typedef {Object} InvoiceRecipient
 * @property {string} name
 * @property {string} taxNumber          // VKN (10 hane) veya TCKN (11 hane)
 * @property {string} [taxOffice]        // vergi dairesi (VKN için)
 * @property {string} address
 *
 * @typedef {Object} InvoicePayload
 * @property {string} localReferenceId   // IDEMPOTENCY anahtarı — Faturaport localReferenceId
 * @property {InvoiceRecipient} recipient
 * @property {InvoiceLineItem[]} lineItems
 * @property {string} currency
 * @property {string} [notes]
 *
 * @typedef {Object} IssueResult
 * @property {string} providerInvoiceId    // ETTN / UUID
 * @property {?string} invoiceNumber       // resmî fatura no — Faturaport'ta poll ile dolar, başta null
 * @property {?string} [pdfBase64]         // bazı sağlayıcılar PDF'i base64 döner (Faturaport add-invoice)
 * @property {?string} [pdfUrl]            // bazıları URL döner
 * @property {'DRAFT'|'SENDING'|'ISSUED'|'FAILED'} status
 * @property {Object} raw                  // sağlayıcıdan gelen HAM cevap (jsonb/Mixed'e saklanacak)
 *
 * @typedef {Object} NormalizedEvent
 * @property {string} providerInvoiceId
 * @property {'ISSUED'|'FAILED'} status
 * @property {Object} raw
 */

/* eslint-disable no-unused-vars, class-methods-use-this */
class InvoicingProvider {
  /**
   * Faturayı entegratöre gönderir. DÖNÜŞ SENKRON KABUL DEĞİLDİR — status
   * 'SENDING' döner; 'ISSUED' yalnız webhook/poll ile kesinleşir (Stage 3).
   * @param {InvoicePayload} payload
   * @returns {Promise<IssueResult>}
   */
  async issueInvoice(payload) { throw new Error('InvoicingProvider.issueInvoice not implemented'); }

  /** @param {string} providerInvoiceId @returns {Promise<string>} normalize durum */
  async getInvoiceStatus(providerInvoiceId) { throw new Error('InvoicingProvider.getInvoiceStatus not implemented'); }

  /**
   * Poll: durum + resmî fatura no'yu birlikte döner (webhook olmayan
   * sağlayıcılarda ISSUED onayı buradan gelir).
   * @param {string} providerInvoiceId
   * @returns {Promise<?{ providerInvoiceId:string, invoiceNumber:?string, status:string, raw:Object }>}
   */
  async getInvoiceRecord(providerInvoiceId) { throw new Error('InvoicingProvider.getInvoiceRecord not implemented'); }

  /** @param {string} providerInvoiceId @param {string} reason */
  async cancelInvoice(providerInvoiceId, reason) { throw new Error('InvoicingProvider.cancelInvoice not implemented'); }

  /**
   * INBOUND yüz: entegratörden gelen ham webhook olayını normalize eder.
   * (Endpoint/route Stage 3'te; burada yalnız sözleşme.)
   * @param {Object} rawPayload
   * @returns {NormalizedEvent}
   */
  handleWebhook(rawPayload) { throw new Error('InvoicingProvider.handleWebhook not implemented'); }
}

module.exports = InvoicingProvider;
