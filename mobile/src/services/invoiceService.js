import api from './api';

// Satış faturaları — web'deki invoiceService ile aynı uç.
// Liste → res.data.data.items (her fatura computed subtotal/totalTax/grandTotal
// ve populate edilmiş customer ile gelir), sayfalama cursor tabanlı
// (hasMore/nextCursor).
const invoiceService = {
  getAll: (params = {}) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  updateStatus: (id, status, paymentNotes) =>
    api.patch(`/invoices/${id}/status`, { status, paymentNotes }),

  // PDF'ler ikili veri — web 'blob' ister, RN'de karşılığı 'arraybuffer'
  // (utils/downloadPdf.js bunu Uint8Array olarak dosyaya yazar).
  getSalesPdf: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'arraybuffer' }),

  // Resmî e-Fatura (GİB) — CRM ödeme durumundan ayrı eksen. issue alıcının
  // vergi bilgilerini zorunlu tutar (eksikse backend 422 döner), onay ise
  // anında gelmez: durum SENDING kalır, refresh ile ISSUED'a döner.
  issueEInvoice: (id, recipient) => api.post(`/invoices/${id}/einvoice/issue`, { recipient }),
  refreshEInvoice: (id) => api.post(`/invoices/${id}/einvoice/refresh`),
  getEInvoicePdf: (id) => api.get(`/invoices/${id}/einvoice/pdf`, { responseType: 'arraybuffer' }),
};

export default invoiceService;
