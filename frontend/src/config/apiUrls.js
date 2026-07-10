/**
 * Single place every service base URL is read from. Falls back to the
 * local-dev ports so nothing changes for local development without a
 * .env file — a real deploy sets these via Vite env vars (VITE_ prefix
 * required for Vite to expose them to client code) instead of editing code.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const INVOICE_API_URL = import.meta.env.VITE_INVOICE_API_URL || 'http://localhost:5001/api';
export const INVOICE_V2_API_URL = import.meta.env.VITE_INVOICE_V2_API_URL || 'http://localhost:5002/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
