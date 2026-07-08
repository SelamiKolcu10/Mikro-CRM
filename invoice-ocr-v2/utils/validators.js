/**
 * Input validators for invoice uploads and data.
 */

const { ALLOWED_MIME_TYPES } = require('./constants');
const config = require('../config');

/**
 * Validate uploaded file(s).
 * @param {Array|Object} files - Multer file(s)
 * @returns {Object} - { valid, errors }
 */
function validateUploadedFiles(files) {
  const errors = [];
  const fileList = Array.isArray(files) ? files : [files];

  if (fileList.length === 0) {
    errors.push('En az bir dosya yüklenmelidir.');
    return { valid: false, errors };
  }

  if (fileList.length > config.upload.maxBulkFiles) {
    errors.push(`Tek seferde en fazla ${config.upload.maxBulkFiles} dosya yüklenebilir.`);
    return { valid: false, errors };
  }

  const maxBytes = config.upload.maxFileSizeMB * 1024 * 1024;

  for (const file of fileList) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      errors.push(`Desteklenmeyen dosya türü: ${file.originalname} (${file.mimetype}). İzin verilen: JPEG, PNG, WebP, PDF`);
    }

    if (file.size > maxBytes) {
      errors.push(`Dosya çok büyük: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimum: ${config.upload.maxFileSizeMB} MB`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate parsed invoice data from OCR output.
 * @param {Object} data - Parsed invoice data
 * @returns {Object} - { valid, errors }
 */
function validateInvoiceData(data) {
  const errors = [];

  if (!data) {
    errors.push('Fatura verisi boş.');
    return { valid: false, errors };
  }

  if (!data.lineItems || !Array.isArray(data.lineItems) || data.lineItems.length === 0) {
    errors.push('Faturada en az bir kalem satırı bulunmalıdır.');
  }

  if (data.lineItems) {
    data.lineItems.forEach((item, idx) => {
      if (typeof item.baseAmount !== 'number' || item.baseAmount < 0) {
        errors.push(`Satır ${idx + 1}: Geçersiz matrah (baseAmount).`);
      }
      if (typeof item.vatRate !== 'number' || item.vatRate < 0) {
        errors.push(`Satır ${idx + 1}: Geçersiz KDV oranı (vatRate).`);
      }
    });
  }

  if (data.grandTotal !== undefined && data.grandTotal !== null) {
    if (typeof data.grandTotal !== 'number' || data.grandTotal < 0) {
      errors.push('Geçersiz genel toplam (grandTotal).');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateUploadedFiles,
  validateInvoiceData,
};
