import api from './api';

// Same endpoints as the web panel. List → res.data.data.items (each with
// computed subtotal/totalTax/grandTotal + populated customer). Detail →
// res.data.data (full quote with items and totals).
const quoteService = {
  getAll: (params = {}) => api.get('/quotes', { params }),
  getById: (id) => api.get(`/quotes/${id}`),
  create: (payload) => api.post('/quotes', payload),

  // PDF'ler ikili veri — web 'blob' ister, RN'de karşılığı 'arraybuffer'
  // (utils/downloadPdf.js bunu Uint8Array olarak dosyaya yazar).
  getPdf: (id) => api.get(`/quotes/${id}/pdf`, { responseType: 'arraybuffer' }),
};

export default quoteService;
