const mongoose = require('mongoose');

/**
 * Financial reporting reads the invoice collections directly rather than
 * calling invoice-ocr-service/invoice-ocr-v2 over HTTP. All three services
 * share the same MongoDB cluster (invoice-ocr-service → `invoices`,
 * invoice-ocr-v2 → `invoicesv2`), so a raw aggregation avoids inter-service
 * auth/network complexity for what is a read-only report. If the services
 * ever move to separate databases, swap these two aggregations for HTTP
 * calls to a `/api/invoices/summary` endpoint on each service.
 */

const MONTHLY_PIPELINE = [
  { $addFields: { effectiveDate: { $ifNull: ['$invoiceDate', '$createdAt'] } } },
  { $addFields: { monthKey: { $dateToString: { format: '%Y-%m', date: '$effectiveDate' } } } },
  {
    $group: {
      _id: '$monthKey',
      totalBase: { $sum: '$totalBase' },
      totalVat: { $sum: '$totalVat' },
      totalSpend: { $sum: '$grandTotal' },
      count: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
];

async function aggregateCollection(collectionName) {
  const collection = mongoose.connection.db.collection(collectionName);
  const [monthly, overallResult] = await Promise.all([
    collection.aggregate(MONTHLY_PIPELINE).toArray(),
    collection
      .aggregate([
        {
          $group: {
            _id: null,
            totalBase: { $sum: '$totalBase' },
            totalVat: { $sum: '$totalVat' },
            totalSpend: { $sum: '$grandTotal' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
  ]);

  const overall = overallResult[0] || { totalBase: 0, totalVat: 0, totalSpend: 0, count: 0 };
  return { monthly, overall };
}

function mergeMonthly(a, b) {
  const map = new Map();
  for (const row of [...a, ...b]) {
    const existing = map.get(row._id) || { month: row._id, totalBase: 0, totalVat: 0, totalSpend: 0, count: 0 };
    existing.totalBase += row.totalBase;
    existing.totalVat += row.totalVat;
    existing.totalSpend += row.totalSpend;
    existing.count += row.count;
    map.set(row._id, existing);
  }
  return Array.from(map.values()).sort((x, y) => x.month.localeCompare(y.month));
}

function roundToCent(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * @route   GET /api/reports/spending-summary
 */
const getSpendingSummary = async (req, res, next) => {
  try {
    const [v1, v2] = await Promise.all([
      aggregateCollection('invoices'),
      aggregateCollection('invoicesv2'),
    ]);

    const overall = {
      totalBase: roundToCent(v1.overall.totalBase + v2.overall.totalBase),
      totalVat: roundToCent(v1.overall.totalVat + v2.overall.totalVat),
      totalSpend: roundToCent(v1.overall.totalSpend + v2.overall.totalSpend),
      count: v1.overall.count + v2.overall.count,
    };

    res.json({
      success: true,
      data: {
        overall,
        byMonth: mergeMonthly(v1.monthly, v2.monthly),
        byService: [
          { service: 'v1', label: 'Fatura v1 (OpenAI)', ...v1.overall, totalBase: roundToCent(v1.overall.totalBase), totalVat: roundToCent(v1.overall.totalVat), totalSpend: roundToCent(v1.overall.totalSpend) },
          { service: 'v2', label: 'Fatura v2 (Yerli OCR)', ...v2.overall, totalBase: roundToCent(v2.overall.totalBase), totalVat: roundToCent(v2.overall.totalVat), totalSpend: roundToCent(v2.overall.totalSpend) },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reports/spending-export
 * @desc    CSV export of every invoice across both services — opens directly
 *          in Excel. UTF-8 BOM included so Turkish characters render correctly.
 */
const exportSpendingCsv = async (req, res, next) => {
  try {
    const projection = {
      vendorName: 1,
      vendorTaxNumber: 1,
      invoiceNumber: 1,
      invoiceDate: 1,
      totalBase: 1,
      totalVat: 1,
      grandTotal: 1,
      validationStatus: 1,
      createdAt: 1,
    };

    const [v1Docs, v2Docs] = await Promise.all([
      mongoose.connection.db.collection('invoices').find({}, { projection }).toArray(),
      mongoose.connection.db.collection('invoicesv2').find({}, { projection }).toArray(),
    ]);

    const rows = [
      ...v1Docs.map((d) => ({ ...d, service: 'Fatura v1' })),
      ...v2Docs.map((d) => ({ ...d, service: 'Fatura v2' })),
    ].sort((a, b) => new Date(a.invoiceDate || a.createdAt) - new Date(b.invoiceDate || b.createdAt));

    const header = ['Servis', 'Satıcı', 'Vergi No', 'Fatura No', 'Fatura Tarihi', 'Matrah', 'KDV', 'Genel Toplam', 'Durum'];
    const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines = [header.map(csvEscape).join(',')];

    for (const row of rows) {
      const date = row.invoiceDate || row.createdAt;
      lines.push(
        [
          row.service,
          row.vendorName || '',
          row.vendorTaxNumber || '',
          row.invoiceNumber || '',
          date ? new Date(date).toLocaleDateString('tr-TR') : '',
          (row.totalBase || 0).toFixed(2),
          (row.totalVat || 0).toFixed(2),
          (row.grandTotal || 0).toFixed(2),
          row.validationStatus || '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    const csv = '﻿' + lines.join('\r\n'); // BOM so Excel reads UTF-8 Turkish chars correctly
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="fatura-raporu-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

module.exports = { getSpendingSummary, exportSpendingCsv };
