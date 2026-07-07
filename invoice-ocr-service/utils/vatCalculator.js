/**
 * VAT Calculator — Mathematical Validation Engine
 *
 * Core of the Invoice OCR Service. Provides:
 *  1. Line-item VAT calculation
 *  2. VAT group summary aggregation
 *  3. Cross-check validation against reported totals
 */

const config = require('../config');
const { VALIDATION_STATUS } = require('./constants');

/**
 * Calculate VAT for a single line item.
 * Formula: vatAmount = baseAmount × (vatRate / 100)
 *
 * @param {Object} item - Line item with baseAmount and vatRate
 * @returns {Object} - Enriched item with calculated vatAmount and totalAmount
 */
function calculateLineVat(item) {
  const baseAmount = roundToCent(Number(item.baseAmount) || 0);
  const vatRate = Number(item.vatRate) || 0;
  const quantity = Number(item.quantity) || 1;
  const unitPrice = Number(item.unitPrice) || baseAmount;

  const vatAmount = roundToCent(baseAmount * (vatRate / 100));
  const totalAmount = roundToCent(baseAmount + vatAmount);

  return {
    description: item.description || '',
    quantity,
    unitPrice,
    baseAmount,
    vatRate,
    vatAmount,
    totalAmount,
  };
}

/**
 * Build VAT summary by grouping line items by their VAT rate.
 *
 * @param {Array} lineItems - Array of processed line items (output of calculateLineVat)
 * @returns {Array} - VAT summary groups, each with totals for that rate
 */
function buildVatSummary(lineItems) {
  const groups = {};

  for (const item of lineItems) {
    const rate = item.vatRate;

    if (!groups[rate]) {
      groups[rate] = {
        vatRate: rate,
        totalBase: 0,
        totalVat: 0,
        totalWithVat: 0,
      };
    }

    groups[rate].totalBase = roundToCent(groups[rate].totalBase + item.baseAmount);
    groups[rate].totalVat = roundToCent(groups[rate].totalVat + item.vatAmount);
    groups[rate].totalWithVat = roundToCent(groups[rate].totalWithVat + item.totalAmount);
  }

  // Sort by VAT rate ascending
  return Object.values(groups).sort((a, b) => a.vatRate - b.vatRate);
}

/**
 * Cross-check calculated totals against the invoice's reported grand total.
 * Uses a configurable tolerance (default ±0.50 TL) to absorb rounding differences.
 *
 * @param {Array} vatSummary - Output of buildVatSummary
 * @param {Number} reportedGrandTotal - The grand total printed on the invoice
 * @returns {Object} - Validation result { status, calculatedTotal, reportedTotal, difference, message }
 */
function crossCheckTotals(vatSummary, reportedGrandTotal) {
  const tolerance = config.vat.tolerance;
  const reported = roundToCent(Number(reportedGrandTotal) || 0);

  // Sum up all VAT group totals
  const calculatedBase = roundToCent(
    vatSummary.reduce((sum, group) => sum + group.totalBase, 0)
  );
  const calculatedVat = roundToCent(
    vatSummary.reduce((sum, group) => sum + group.totalVat, 0)
  );
  const calculatedTotal = roundToCent(
    vatSummary.reduce((sum, group) => sum + group.totalWithVat, 0)
  );

  const difference = roundToCent(Math.abs(calculatedTotal - reported));
  const isMatch = difference <= tolerance;

  return {
    status: isMatch ? VALIDATION_STATUS.VERIFIED : VALIDATION_STATUS.MISMATCH,
    calculatedBase,
    calculatedVat,
    calculatedTotal,
    reportedTotal: reported,
    difference,
    message: isMatch
      ? null
      : `Toplam uyuşmazlığı: Hesaplanan ${calculatedTotal} TL, faturadaki ${reported} TL. Fark: ${difference} TL. Lütfen gözle kontrol edin.`,
  };
}

/**
 * Full validation pipeline: processes raw line items and validates against reported total.
 *
 * @param {Array} rawLineItems - Raw line items from AI/OCR output
 * @param {Number} reportedGrandTotal - Invoice's printed grand total
 * @returns {Object} - { lineItems, vatSummary, totals, validation }
 */
function validateInvoice(rawLineItems, reportedGrandTotal) {
  // Step 1: Calculate VAT for each line item
  const lineItems = rawLineItems.map(calculateLineVat);

  // Step 2: Build VAT group summary
  const vatSummary = buildVatSummary(lineItems);

  // Step 3: Cross-check against reported total
  const validation = crossCheckTotals(vatSummary, reportedGrandTotal);

  return {
    lineItems,
    vatSummary,
    totals: {
      totalBase: validation.calculatedBase,
      totalVat: validation.calculatedVat,
      grandTotal: validation.calculatedTotal,
    },
    validation: {
      status: validation.status,
      calculatedTotal: validation.calculatedTotal,
      reportedTotal: validation.reportedTotal,
      difference: validation.difference,
      message: validation.message,
    },
  };
}

/**
 * Round to 2 decimal places (kuruş precision).
 */
function roundToCent(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

module.exports = {
  calculateLineVat,
  buildVatSummary,
  crossCheckTotals,
  validateInvoice,
  roundToCent,
};
