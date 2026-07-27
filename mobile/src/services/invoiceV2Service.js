import axios from 'axios';
import { INVOICE_V2_API_URL } from '../config/apiUrls';
import { tokenStorage } from '../platform/tokenStorage';

// Gelen Faturalar (Yerli OCR / Tesseract) — ayrı mikroservis, ayrı base URL.
// Üç servis de aynı JWT_SECRET'i paylaştığı için ana backend'in verdiği token
// burada da geçerli; sadece kendi axios örneğine ihtiyacı var.
// Yetki: yalnız super_admin + accountant (bkz. invoice-ocr-v2/routes).
const invoiceV2Api = axios.create({
  baseURL: INVOICE_V2_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

invoiceV2Api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const invoiceV2Service = {
  getAll: (params = {}) => invoiceV2Api.get('/invoices', { params }),
  getById: (id) => invoiceV2Api.get(`/invoices/${id}`),
  getStats: () => invoiceV2Api.get('/invoices/stats/summary'),
  update: (id, data) => invoiceV2Api.put(`/invoices/${id}`, data),
  delete: (id) => invoiceV2Api.delete(`/invoices/${id}`),

  /**
   * Tek fatura yükle. React Native'de dosya, web'deki File nesnesi yerine
   * { uri, name, type } üçlüsüyle FormData'ya konur — Content-Type başlığını
   * elle vermiyoruz ki axios/RN multipart sınırını (boundary) kendisi koysun.
   */
  upload: (file) => {
    const form = new FormData();
    form.append('invoice', { uri: file.uri, name: file.name, type: file.mimeType });
    return invoiceV2Api.post('/invoices/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // OCR işlemi uzun sürebiliyor
    });
  },

  bulkUpload: (files) => {
    const form = new FormData();
    files.forEach((f) => form.append('invoices', { uri: f.uri, name: f.name, type: f.mimeType }));
    return invoiceV2Api.post('/invoices/bulk-upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
  },
};

export default invoiceV2Service;
