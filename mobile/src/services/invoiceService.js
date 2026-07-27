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
};

export default invoiceService;
