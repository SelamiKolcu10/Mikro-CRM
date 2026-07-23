const mongoose = require('mongoose');
const { ROLES } = require('../config/permissions');

/**
 * Financial reporting reads the invoice collection directly rather than calling
 * invoice-ocr-v2 over HTTP — both share the same MongoDB cluster
 * (invoice-ocr-v2 → `invoicesv2`), so a raw aggregation avoids inter-service
 * auth/network complexity for what is a read-only report. If the service ever
 * moves to a separate database, swap the aggregation for an HTTP call to a
 * `/api/invoices/summary` endpoint.
 *
 * Kapsam: yalnızca yerli OCR (`invoicesv2`). Eski API'li v1 (`invoices`)
 * rapordan çıkarıldı; ayrıca `invoices` koleksiyonu CRM satış faturalarını da
 * tuttuğu için gider raporuna karışmaması istendi.
 */

const EFFECTIVE_DATE = { $ifNull: ['$invoiceDate', '$createdAt'] };

function roundToCent(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Inclusive [00:00 dateFrom, 23:59:59.999 dateTo] range, or null if neither is set. */
function buildDateRange(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return null;
  const range = {};
  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    range.$gte = from;
  }
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    range.$lte = to;
  }
  return range;
}

/** The equal-length window immediately preceding [dateFrom, dateTo] — for trend comparison. */
function buildPreviousRange(dateFrom, dateTo) {
  const from = new Date(dateFrom);
  from.setHours(0, 0, 0, 0);
  const to = new Date(dateTo);
  to.setHours(23, 59, 59, 999);
  const durationMs = to.getTime() - from.getTime() + 1;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs + 1);
  return { $gte: prevFrom, $lte: prevTo };
}

function withDateMatch(stages, dateRange) {
  const pipeline = [{ $addFields: { effectiveDate: EFFECTIVE_DATE } }];
  if (dateRange) pipeline.push({ $match: { effectiveDate: dateRange } });
  return pipeline.concat(stages);
}

const MONTHLY_STAGES = [
  { $addFields: { monthKey: { $dateToString: { format: '%Y-%m', date: '$effectiveDate' } } } },
  { $group: { _id: '$monthKey', totalBase: { $sum: '$totalBase' }, totalVat: { $sum: '$totalVat' }, totalSpend: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
];

const OVERALL_STAGES = [
  { $group: { _id: null, totalBase: { $sum: '$totalBase' }, totalVat: { $sum: '$totalVat' }, totalSpend: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
];

const VENDOR_STAGES = [
  { $group: { _id: { $ifNull: [{ $trim: { input: '$vendorName' } }, ''] }, totalSpend: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
  { $match: { _id: { $ne: '' } } },
  { $sort: { totalSpend: -1 } },
  { $limit: 10 },
];

// vatSummary is per-invoice (an invoice can have multiple VAT-rate line
// groups) — unwind so each rate's contribution is counted independently of
// the others on the same invoice.
const VAT_STAGES = [
  { $unwind: '$vatSummary' },
  { $group: { _id: '$vatSummary.vatRate', totalBase: { $sum: '$vatSummary.totalBase' }, totalVat: { $sum: '$vatSummary.totalVat' } } },
  { $sort: { _id: 1 } },
];

async function aggregateCollection(collectionName, dateRange) {
  const collection = mongoose.connection.db.collection(collectionName);
  const [monthly, overallResult, vendors, vat] = await Promise.all([
    collection.aggregate(withDateMatch(MONTHLY_STAGES, dateRange)).toArray(),
    collection.aggregate(withDateMatch(OVERALL_STAGES, dateRange)).toArray(),
    collection.aggregate(withDateMatch(VENDOR_STAGES, dateRange)).toArray(),
    collection.aggregate(withDateMatch(VAT_STAGES, dateRange)).toArray(),
  ]);

  const overall = overallResult[0] || { totalBase: 0, totalVat: 0, totalSpend: 0, count: 0 };
  return { monthly, overall, vendors, vat };
}

async function aggregateOverallOnly(collectionName, dateRange) {
  const collection = mongoose.connection.db.collection(collectionName);
  const result = await collection.aggregate(withDateMatch(OVERALL_STAGES, dateRange)).toArray();
  return result[0] || { totalBase: 0, totalVat: 0, totalSpend: 0, count: 0 };
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

function mergeVendors(a, b) {
  const map = new Map();
  for (const row of [...a, ...b]) {
    const existing = map.get(row._id) || { vendor: row._id, totalSpend: 0, count: 0 };
    existing.totalSpend += row.totalSpend;
    existing.count += row.count;
    map.set(row._id, existing);
  }
  return Array.from(map.values())
    .map((v) => ({ ...v, totalSpend: roundToCent(v.totalSpend) }))
    .sort((x, y) => y.totalSpend - x.totalSpend)
    .slice(0, 10);
}

function mergeVat(a, b) {
  const map = new Map();
  for (const row of [...a, ...b]) {
    const existing = map.get(row._id) || { vatRate: row._id, totalBase: 0, totalVat: 0 };
    existing.totalBase += row.totalBase;
    existing.totalVat += row.totalVat;
    map.set(row._id, existing);
  }
  return Array.from(map.values())
    .map((v) => ({ ...v, totalBase: roundToCent(v.totalBase), totalVat: roundToCent(v.totalVat) }))
    .sort((x, y) => x.vatRate - y.vatRate);
}

/**
 * @route   GET /api/reports/spending-summary
 * @query   dateFrom, dateTo (optional, YYYY-MM-DD) — filters everything below
 *          to that range. When both are given, also returns `trend`: the
 *          same range's totals compared against the equal-length period
 *          immediately before it.
 */
const getSpendingSummary = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateRange = buildDateRange(dateFrom, dateTo);

    // Tek kaynak: yerli OCR (invoicesv2). Eski API'li v1 (`invoices` koleksiyonu)
    // rapordan çıkarıldı — o koleksiyon CRM satış faturalarıyla da paylaşıldığı
    // için gider toplamına karışmaması ayrıca istenen bir düzeltmeydi.
    const v2 = await aggregateCollection('invoicesv2', dateRange);

    const overall = {
      totalBase: roundToCent(v2.overall.totalBase),
      totalVat: roundToCent(v2.overall.totalVat),
      totalSpend: roundToCent(v2.overall.totalSpend),
      count: v2.overall.count,
    };

    let trend = null;
    if (dateFrom && dateTo) {
      const previousRange = buildPreviousRange(dateFrom, dateTo);
      const v2Prev = await aggregateOverallOnly('invoicesv2', previousRange);
      const previousTotalSpend = roundToCent(v2Prev.totalSpend);
      const changeAbsolute = roundToCent(overall.totalSpend - previousTotalSpend);
      const changePercent = previousTotalSpend > 0
        ? roundToCent((changeAbsolute / previousTotalSpend) * 100)
        : null; // no prior spend to compare against — percent change is undefined, not 0
      trend = { previousTotalSpend, changeAbsolute, changePercent };
    }

    res.json({
      success: true,
      data: {
        overall,
        byMonth: mergeMonthly(v2.monthly, []),
        byService: [
          { service: 'v2', label: 'Fatura v2 (Yerli OCR)', ...v2.overall, totalBase: roundToCent(v2.overall.totalBase), totalVat: roundToCent(v2.overall.totalVat), totalSpend: roundToCent(v2.overall.totalSpend) },
        ],
        byVendor: mergeVendors(v2.vendors, []),
        byVat: mergeVat(v2.vat, []),
        trend,
        filters: { dateFrom: dateFrom || null, dateTo: dateTo || null },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/reports/spending-export
 * @query   dateFrom, dateTo (optional) — same filter as spending-summary, so
 *          "export what I'm looking at" behaves as expected.
 * @desc    CSV export of every invoice across both services — opens directly
 *          in Excel. UTF-8 BOM included so Turkish characters render correctly.
 */
const exportSpendingCsv = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateRange = buildDateRange(dateFrom, dateTo);

    // Intern has spendingReport.read for spend visibility, but vendor tax
    // numbers are withheld from their export — accountant/super_admin still
    // get them (needed for accounting/reporting).
    const withholdTaxNumber = req.user.role === ROLES.INTERN;

    const projection = {
      vendorName: 1,
      vendorTaxNumber: 1,
      invoiceNumber: 1,
      invoiceDate: 1,
      createdAt: 1,
      totalBase: 1,
      totalVat: 1,
      grandTotal: 1,
      validationStatus: 1,
    };

    const matchStage = dateRange
      ? [{ $addFields: { effectiveDate: EFFECTIVE_DATE } }, { $match: { effectiveDate: dateRange } }, { $project: projection }]
      : [{ $project: projection }];

    const v2Docs = await mongoose.connection.db.collection('invoicesv2').aggregate(matchStage).toArray();

    const rows = v2Docs
      .map((d) => ({ ...d, service: 'Fatura v2' }))
      .sort((a, b) => new Date(a.invoiceDate || a.createdAt) - new Date(b.invoiceDate || b.createdAt));

    const header = ['Servis', 'Satıcı', 'Vergi No', 'Fatura No', 'Fatura Tarihi', 'Matrah', 'KDV', 'Genel Toplam', 'Durum'];
    const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines = [header.map(csvEscape).join(',')];

    for (const row of rows) {
      const date = row.invoiceDate || row.createdAt;
      lines.push(
        [
          row.service,
          row.vendorName || '',
          withholdTaxNumber ? '' : row.vendorTaxNumber || '',
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
