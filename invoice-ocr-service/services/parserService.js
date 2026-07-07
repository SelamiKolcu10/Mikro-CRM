/**
 * Parser Service — Transforms raw AI text output into structured data
 *
 * Handles edge cases where the AI might return markdown-wrapped JSON,
 * extra text, or malformed responses.
 */

/**
 * Parse the raw text response from Gemini AI into a structured object.
 *
 * @param {string} rawText - Raw text output from Gemini
 * @returns {Object} - Parsed invoice data
 */
function parseAIResponse(rawText) {
  try {
    // Remove markdown code fences if present (```json ... ```)
    let cleaned = rawText.trim();

    // Strip leading/trailing markdown code blocks
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // Try to extract JSON from the text (find first { to last })
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('JSON bulunamadı — AI yanıtında geçerli bir JSON objesi yok.');
    }

    const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonStr);

    // Normalize and sanitize the parsed data
    return normalizeInvoiceData(parsed);
  } catch (error) {
    console.error('Parser Error:', error.message);
    return {
      vendorName: '',
      vendorTaxNumber: '',
      invoiceNumber: '',
      invoiceDate: null,
      lineItems: [],
      grandTotal: 0,
      confidenceScore: 0,
      parseError: error.message,
    };
  }
}

/**
 * Normalize parsed invoice data — ensure all fields have correct types.
 *
 * @param {Object} data - Raw parsed JSON
 * @returns {Object} - Normalized invoice data
 */
function normalizeInvoiceData(data) {
  const normalized = {
    vendorName: String(data.vendorName || '').trim(),
    vendorTaxNumber: String(data.vendorTaxNumber || '').trim(),
    invoiceNumber: String(data.invoiceNumber || '').trim(),
    invoiceDate: parseDate(data.invoiceDate),
    grandTotal: toNumber(data.grandTotal),
    confidenceScore: Math.min(100, Math.max(0, toNumber(data.confidenceScore))),
    lineItems: [],
  };

  // Normalize line items
  if (Array.isArray(data.lineItems)) {
    normalized.lineItems = data.lineItems.map((item, index) => ({
      description: String(item.description || `Kalem ${index + 1}`).trim(),
      quantity: toNumber(item.quantity) || 1,
      unitPrice: toNumber(item.unitPrice),
      baseAmount: toNumber(item.baseAmount),
      vatRate: toNumber(item.vatRate),
      vatAmount: toNumber(item.vatAmount),
      totalAmount: toNumber(item.totalAmount),
    }));
  }

  return normalized;
}

/**
 * Safely convert a value to a number.
 */
function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Handle Turkish number format: "1.000,50" → 1000.50
    const cleaned = value
      .replace(/[^\d.,-]/g, '')  // Remove non-numeric chars except . , -
      .replace(/\.(?=.*\.)/g, '') // Remove thousands separators (keep last dot)
      .replace(',', '.');         // Replace comma with dot for decimals
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Parse date string into a Date object.
 * Supports: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;

  const str = String(dateStr).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str);
  }

  // DD.MM.YYYY or DD/MM/YYYY
  const match = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) {
    return new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
  }

  // Try native parsing as fallback
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

module.exports = {
  parseAIResponse,
  normalizeInvoiceData,
  toNumber,
  parseDate,
};
