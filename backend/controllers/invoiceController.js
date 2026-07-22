const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');
const QuoteEvent = require('../models/QuoteEvent');
const Counter = require('../models/Counter');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const { withComputedTotals } = require('../utils/quoteTotals');

const INVOICE_POPULATE = [
  { path: 'customer', select: 'name email company' },
  { path: 'owner', select: 'name email' },
  { path: 'deal', select: 'title' },
  { path: 'quote', select: 'quoteNumber status' },
];

/**
 * Fatura numarası üret: FTR-2026-0001
 */
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const seq = await Counter.next(`invoice-${year}`);
  return `FTR-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * @route   GET /api/invoices
 * @desc    Satış faturaları listesi.
 */
const getInvoices = async (req, res, next) => {
  try {
    const { customer, deal, status, before, limit: rawLimit } = req.query;
    const filter = {};
    if (customer) filter.customer = customer;
    if (deal) filter.deal = deal;
    if (status) filter.status = status;
    if (before) filter.createdAt = { $lt: new Date(before) };

    const limit = Math.min(parseInt(rawLimit, 10) || 50, 100);

    const invoices = await Invoice.find(filter)
      .populate(INVOICE_POPULATE)
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    const hasMore = invoices.length > limit;
    const page = hasMore ? invoices.slice(0, limit) : invoices;
    const nextCursor = hasMore ? page[page.length - 1].createdAt : null;

    res.json({
      success: true,
      data: {
        items: page.map((inv) => withComputedTotals(inv)),
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/invoices
 * @desc    Manuel satış faturası oluştur.
 */
const createInvoice = async (req, res, next) => {
  try {
    const { customerId, dealId, currency, issueDate, dueDate, notes, paymentNotes, items } = req.body;

    const customer = await Customer.findById(customerId).select('_id').lean();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Müşteri bulunamadı.' });
    }

    if (dealId) {
      const deal = await Deal.findById(dealId).select('_id').lean();
      if (!deal) {
        return res.status(404).json({ success: false, error: 'Fırsat bulunamadı.' });
      }
    }

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      customer: customerId,
      deal: dealId || null,
      owner: req.user._id,
      currency: currency || 'TRY',
      issueDate: issueDate || new Date(),
      dueDate: dueDate || null,
      notes: notes || '',
      paymentNotes: paymentNotes || '',
      items: items.map((it) => ({
        product: it.productId || null,
        name: it.name,
        description: it.description || '',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate !== undefined ? it.taxRate : 20,
        discountRate: it.discountRate || 0,
      })),
    });

    await invoice.populate(INVOICE_POPULATE);
    res.status(201).json({ success: true, data: withComputedTotals(invoice) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/invoices/from-quote/:quoteId
 * @desc    Onaylanmış teklifi satış faturasına dönüştür.
 */
const generateFromQuote = async (req, res, next) => {
  try {
    const { quoteId } = req.params;
    const quote = await Quote.findById(quoteId);

    if (!quote) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı.' });
    }

    if (quote.status !== 'accepted') {
      return res.status(422).json({
        success: false,
        error: 'Sadece onaylanmış (accepted) teklifler faturaya dönüştürülebilir.',
      });
    }

    if (quote.invoice) {
      return res.status(422).json({
        success: false,
        error: 'Bu teklif zaten faturaya dönüştürülmüştür.',
      });
    }

    const invoiceNumber = await generateInvoiceNumber();

    const clonedItems = (quote.items || []).map((item) => ({
      product: item.product || null,
      name: item.name,
      description: item.description || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discountRate: item.discountRate || 0,
    }));

    const invoice = await Invoice.create({
      invoiceNumber,
      quote: quote._id,
      customer: quote.customer,
      deal: quote.deal || null,
      owner: req.user._id,
      status: 'issued',
      currency: quote.currency,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Varsayılan 14 gün vade
      notes: quote.notes || '',
      items: clonedItems,
    });

    quote.invoice = invoice._id;
    await quote.save();

    await QuoteEvent.create({
      quote: quote._id,
      actor: req.user._id,
      actorName: req.user.name,
      type: 'invoiced',
      note: `Teklif ${invoice.invoiceNumber} faturasına dönüştürüldü.`,
      metadata: { invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber },
    });

    await invoice.populate(INVOICE_POPULATE);
    res.status(201).json({ success: true, data: withComputedTotals(invoice) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/invoices/:id
 * @desc    Fatura detayı.
 */
const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate(INVOICE_POPULATE);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Fatura bulunamadı.' });
    }
    res.json({ success: true, data: withComputedTotals(invoice) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/invoices/:id/status
 * @desc    Fatura durumunu güncelle (draft, issued, paid, overdue, cancelled).
 */
const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { status, paymentNotes } = req.body;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Fatura bulunamadı.' });
    }

    invoice.status = status;
    if (paymentNotes !== undefined) invoice.paymentNotes = paymentNotes;

    if (status === 'paid' && !invoice.paidAt) {
      invoice.paidAt = new Date();
    }

    await invoice.save();
    await invoice.populate(INVOICE_POPULATE);

    res.json({ success: true, data: withComputedTotals(invoice) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/invoices/:id/pdf
 * @desc    Fatura PDF indirme.
 */
const getInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate(INVOICE_POPULATE);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Fatura bulunamadı.' });
    }

    const { buildQuoteHtml } = require('../utils/quotePdf');
    const { renderHtmlToPdf } = require('../utils/pdfRenderer');
    const companyProfile = require('../config/companyProfile');

    const invoiceData = withComputedTotals(invoice);
    // Fatura başlığı ile şablonu yeniden kullan
    const htmlData = {
      ...invoiceData,
      quoteNumber: invoiceData.invoiceNumber, // Fatura numarasını başlığa ver
    };

    const html = buildQuoteHtml(htmlData, companyProfile);
    const pdfBuffer = await renderHtmlToPdf(html);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInvoices,
  createInvoice,
  generateFromQuote,
  getInvoice,
  updateInvoiceStatus,
  getInvoicePdf,
};
