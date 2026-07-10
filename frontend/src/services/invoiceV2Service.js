import axios from 'axios';
import { INVOICE_V2_API_URL } from '../config/apiUrls';

// Dedicated API instance for Invoice OCR v2 Service — Yerli OCR / Tesseract.js (port 5002)
const invoiceV2Api = axios.create({
  baseURL: INVOICE_V2_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// This service requires auth (super_admin/accountant only) — attach the same
// JWT the main backend issues, since all three services share JWT_SECRET.
invoiceV2Api.interceptors.request.use((config) => {
  const token = localStorage.getItem('micro-crm-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const invoiceV2Service = {
  // Upload single invoice
  upload: (file) => {
    const formData = new FormData();
    formData.append('invoice', file);
    return invoiceV2Api.post('/invoices/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Bulk upload invoices
  bulkUpload: (files, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('invoices', file));
    return invoiceV2Api.post('/invoices/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },

  // Get all invoices with pagination & filters
  getAll: (params = {}) => {
    return invoiceV2Api.get('/invoices', { params });
  },

  // Get single invoice by ID
  getById: (id) => {
    return invoiceV2Api.get(`/invoices/${id}`);
  },

  // Update invoice (manual correction)
  update: (id, data) => {
    return invoiceV2Api.put(`/invoices/${id}`, data);
  },

  // Delete invoice
  delete: (id) => {
    return invoiceV2Api.delete(`/invoices/${id}`);
  },

  // Get processing statistics
  getStats: () => {
    return invoiceV2Api.get('/invoices/stats/summary');
  },
};

export default invoiceV2Service;
