import api from './api';

/**
 * Satış Faturaları (Satış Faturası - P3b) — ana backend `/api/invoices`.
 *
 * Not: Eski v1 OCR (invoice-ocr-service, port 5001, OpenAI/Gemini API'li) çağrıları
 * bu servisten kaldırıldı. Gelen fatura OCR'ı artık tek "yerli OCR" servisiyle
 * (invoiceV2Service, port 5002) yürüyor; Faturalar sayfası ikisini de sekmeli
 * gösterir (bkz. pages/Invoices.jsx).
 */
const invoiceService = {
  getSalesInvoices: (params) => api.get('/invoices', { params }),
  getSalesInvoice: (id) => api.get(`/invoices/${id}`),
  createSalesInvoice: (data) => api.post('/invoices', data),
  updateSalesInvoice: (id, data) => api.put(`/invoices/${id}`, data),
  generateFromQuote: (quoteId) => api.post(`/invoices/from-quote/${quoteId}`),
  updateSalesStatus: (id, status, paymentNotes) =>
    api.patch(`/invoices/${id}/status`, { status, paymentNotes }),
  getSalesPdf: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),

  // Resmî e-Fatura (GİB entegratörü — sağlayıcı-bağımsız)
  issueEInvoice: (id, recipient) => api.post(`/invoices/${id}/einvoice/issue`, { recipient }),
  refreshEInvoice: (id) => api.post(`/invoices/${id}/einvoice/refresh`),
  getEInvoicePdf: (id) => api.get(`/invoices/${id}/einvoice/pdf`, { responseType: 'blob' }),
};

export default invoiceService;
