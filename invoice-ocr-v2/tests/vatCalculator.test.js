/**
 * Unit tests for VAT Calculator — Mathematical Validation Engine
 */

// Mock config before requiring vatCalculator
jest.mock('../config', () => ({
  vat: { tolerance: 0.50 },
}));

const {
  calculateLineVat,
  buildVatSummary,
  crossCheckTotals,
  validateInvoice,
  roundToCent,
} = require('../utils/vatCalculator');

// ─── roundToCent ─────────────────────────────────────────────

describe('roundToCent', () => {
  test('rounds 1.005 correctly', () => {
    expect(roundToCent(1.005)).toBe(1.01);
  });

  test('rounds 1.004 down', () => {
    expect(roundToCent(1.004)).toBe(1);
  });

  test('handles whole numbers', () => {
    expect(roundToCent(100)).toBe(100);
  });

  test('handles zero', () => {
    expect(roundToCent(0)).toBe(0);
  });

  test('handles negative numbers', () => {
    expect(roundToCent(-1.555)).toBe(-1.55);
  });
});

// ─── calculateLineVat ────────────────────────────────────────

describe('calculateLineVat', () => {
  test('calculates 10% VAT correctly', () => {
    const result = calculateLineVat({
      description: 'Yemek',
      baseAmount: 1000,
      vatRate: 10,
    });
    expect(result.vatAmount).toBe(100);
    expect(result.totalAmount).toBe(1100);
    expect(result.baseAmount).toBe(1000);
  });

  test('calculates 20% VAT correctly', () => {
    const result = calculateLineVat({
      description: 'Hizmet',
      baseAmount: 5000,
      vatRate: 20,
    });
    expect(result.vatAmount).toBe(1000);
    expect(result.totalAmount).toBe(6000);
  });

  test('calculates 1% VAT correctly', () => {
    const result = calculateLineVat({
      description: 'Ekmek',
      baseAmount: 200,
      vatRate: 1,
    });
    expect(result.vatAmount).toBe(2);
    expect(result.totalAmount).toBe(202);
  });

  test('handles 0% VAT (tax-exempt)', () => {
    const result = calculateLineVat({
      description: 'İstisna',
      baseAmount: 500,
      vatRate: 0,
    });
    expect(result.vatAmount).toBe(0);
    expect(result.totalAmount).toBe(500);
  });

  test('handles missing fields gracefully', () => {
    const result = calculateLineVat({});
    expect(result.baseAmount).toBe(0);
    expect(result.vatRate).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
    expect(result.description).toBe('');
    expect(result.quantity).toBe(1);
  });

  test('handles decimal base amounts', () => {
    const result = calculateLineVat({
      description: 'Restoran',
      baseAmount: 123.45,
      vatRate: 10,
    });
    expect(result.vatAmount).toBe(12.35);
    expect(result.totalAmount).toBe(135.8);
  });
});

// ─── buildVatSummary ─────────────────────────────────────────

describe('buildVatSummary', () => {
  test('groups items by VAT rate', () => {
    const items = [
      { description: 'A', baseAmount: 1000, vatRate: 10, vatAmount: 100, totalAmount: 1100, quantity: 1, unitPrice: 1000 },
      { description: 'B', baseAmount: 2000, vatRate: 10, vatAmount: 200, totalAmount: 2200, quantity: 1, unitPrice: 2000 },
      { description: 'C', baseAmount: 5000, vatRate: 20, vatAmount: 1000, totalAmount: 6000, quantity: 1, unitPrice: 5000 },
    ];

    const summary = buildVatSummary(items);

    expect(summary).toHaveLength(2);
    expect(summary[0].vatRate).toBe(10);
    expect(summary[0].totalBase).toBe(3000);
    expect(summary[0].totalVat).toBe(300);
    expect(summary[0].totalWithVat).toBe(3300);
    expect(summary[1].vatRate).toBe(20);
    expect(summary[1].totalBase).toBe(5000);
    expect(summary[1].totalVat).toBe(1000);
    expect(summary[1].totalWithVat).toBe(6000);
  });

  test('returns sorted by VAT rate ascending', () => {
    const items = [
      { baseAmount: 100, vatRate: 20, vatAmount: 20, totalAmount: 120, quantity: 1, unitPrice: 100, description: 'X' },
      { baseAmount: 100, vatRate: 1, vatAmount: 1, totalAmount: 101, quantity: 1, unitPrice: 100, description: 'Y' },
      { baseAmount: 100, vatRate: 10, vatAmount: 10, totalAmount: 110, quantity: 1, unitPrice: 100, description: 'Z' },
    ];

    const summary = buildVatSummary(items);
    expect(summary[0].vatRate).toBe(1);
    expect(summary[1].vatRate).toBe(10);
    expect(summary[2].vatRate).toBe(20);
  });

  test('handles single item', () => {
    const items = [
      { baseAmount: 500, vatRate: 10, vatAmount: 50, totalAmount: 550, quantity: 1, unitPrice: 500, description: 'Solo' },
    ];
    const summary = buildVatSummary(items);
    expect(summary).toHaveLength(1);
    expect(summary[0].totalWithVat).toBe(550);
  });

  test('handles empty array', () => {
    const summary = buildVatSummary([]);
    expect(summary).toHaveLength(0);
  });
});

// ─── crossCheckTotals ────────────────────────────────────────

describe('crossCheckTotals', () => {
  const sampleSummary = [
    { vatRate: 10, totalBase: 1000, totalVat: 100, totalWithVat: 1100 },
    { vatRate: 20, totalBase: 5000, totalVat: 1000, totalWithVat: 6000 },
  ];

  test('returns verified when totals match exactly', () => {
    const result = crossCheckTotals(sampleSummary, 7100);
    expect(result.status).toBe('verified');
    expect(result.difference).toBe(0);
    expect(result.message).toBeNull();
  });

  test('returns verified within tolerance (±0.50 TL)', () => {
    const result = crossCheckTotals(sampleSummary, 7100.30);
    expect(result.status).toBe('verified');
    expect(result.difference).toBe(0.30);
  });

  test('returns verified at exact tolerance boundary', () => {
    const result = crossCheckTotals(sampleSummary, 7100.50);
    expect(result.status).toBe('verified');
    expect(result.difference).toBe(0.50);
  });

  test('returns mismatch when over tolerance', () => {
    const result = crossCheckTotals(sampleSummary, 7101);
    expect(result.status).toBe('mismatch');
    expect(result.difference).toBe(1);
    expect(result.message).toBeTruthy();
    expect(result.message).toContain('uyuşmazlığı');
  });

  test('returns mismatch for significantly different total', () => {
    const result = crossCheckTotals(sampleSummary, 8000);
    expect(result.status).toBe('mismatch');
    expect(result.difference).toBe(900);
  });

  test('handles zero reported total', () => {
    const result = crossCheckTotals(sampleSummary, 0);
    expect(result.status).toBe('mismatch');
  });

  test('handles empty vatSummary', () => {
    const result = crossCheckTotals([], 0);
    expect(result.status).toBe('verified');
    expect(result.calculatedTotal).toBe(0);
  });
});

// ─── validateInvoice (Full Pipeline) ─────────────────────────

describe('validateInvoice', () => {
  test('mentor scenario: otel + restoran faturası (1000 TL %10 + 5000 TL %20 = 7100 TL)', () => {
    const rawItems = [
      { description: 'Yemek', baseAmount: 1000, vatRate: 10, quantity: 1 },
      { description: 'Hizmet', baseAmount: 5000, vatRate: 20, quantity: 1 },
    ];

    const result = validateInvoice(rawItems, 7100);

    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0].vatAmount).toBe(100);
    expect(result.lineItems[1].vatAmount).toBe(1000);
    expect(result.vatSummary).toHaveLength(2);
    expect(result.totals.totalBase).toBe(6000);
    expect(result.totals.totalVat).toBe(1100);
    expect(result.totals.grandTotal).toBe(7100);
    expect(result.validation.status).toBe('verified');
    expect(result.validation.difference).toBe(0);
  });

  test('mixed VAT rates: %1 + %10 + %20', () => {
    const rawItems = [
      { description: 'Ekmek', baseAmount: 100, vatRate: 1, quantity: 1 },
      { description: 'Yemek', baseAmount: 200, vatRate: 10, quantity: 1 },
      { description: 'Teknoloji', baseAmount: 300, vatRate: 20, quantity: 1 },
    ];

    const result = validateInvoice(rawItems, 681);
    expect(result.validation.status).toBe('verified');
    expect(result.totals.grandTotal).toBe(681);
  });

  test('detects mismatch when OCR misreads a digit', () => {
    const rawItems = [
      { description: 'Ürün', baseAmount: 800, vatRate: 20, quantity: 1 },
    ];
    const result = validateInvoice(rawItems, 9600);
    expect(result.validation.status).toBe('mismatch');
    expect(result.validation.message).toContain('uyuşmazlığı');
  });

  test('single item invoice', () => {
    const rawItems = [
      { description: 'Hizmet', baseAmount: 2500, vatRate: 20, quantity: 1 },
    ];
    const result = validateInvoice(rawItems, 3000);
    expect(result.validation.status).toBe('verified');
    expect(result.totals.grandTotal).toBe(3000);
  });

  test('handles rounding within tolerance', () => {
    const rawItems = [
      { description: 'A', baseAmount: 33.33, vatRate: 10, quantity: 1 },
      { description: 'B', baseAmount: 66.67, vatRate: 10, quantity: 1 },
    ];
    const result = validateInvoice(rawItems, 110);
    expect(result.validation.status).toBe('verified');
  });
});
