import axios from 'axios';
import { INVOICE_API_URL } from '../config/apiUrls';

// Dedicated API instance for Invoice OCR Service (port 5001)
const invoiceApi = axios.create({
  baseURL: INVOICE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// This service requires auth (super_admin/accountant only) — attach the same
// JWT the main backend issues, since all three services share JWT_SECRET.
invoiceApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('micro-crm-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const invoiceService = {
  // Upload single invoice
  upload: (file) => {
    const formData = new FormData();
    formData.append('invoice', file);
    return invoiceApi.post('/invoices/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Bulk upload invoices
  bulkUpload: (files, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('invoices', file));
    return invoiceApi.post('/invoices/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },

  // Get all invoices with pagination & filters
  getAll: (params = {}) => {
    return invoiceApi.get('/invoices', { params });
  },

  // Get single invoice by ID
  getById: (id) => {
    return invoiceApi.get(`/invoices/${id}`);
  },

  // Update invoice (manual correction)
  update: (id, data) => {
    return invoiceApi.put(`/invoices/${id}`, data);
  },

  // Delete invoice
  delete: (id) => {
    return invoiceApi.delete(`/invoices/${id}`);
  },

  // Get processing statistics
  getStats: () => {
    return invoiceApi.get('/invoices/stats/summary');
  },

  // Sales Invoice (Satış Faturası - P3b) — main backend API
  getSalesInvoices: (params) => {
    const api = require('./api').default;
    return api.get('/invoices', { params });
  },
  getSalesInvoice: (id) => {
    const api = require('./api').default;
    return api.get(`/invoices/${id}`);
  },
  createSalesInvoice: (data) => {
    const api = require('./api').default;
    return api.post('/invoices', data);
  },
  generateFromQuote: (quoteId) => {
    const api = require('./api').default;
    return api.post(`/invoices/from-quote/${quoteId}`);
  },
  updateSalesStatus: (id, status, paymentNotes) => {
    const api = require('./api').default;
    return api.patch(`/invoices/${id}/status`, { status, paymentNotes });
  },
  getSalesPdf: (id) => {
    const api = require('./api').default;
    return api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
  },
};

export default invoiceService;
