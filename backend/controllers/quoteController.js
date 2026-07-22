const crypto = require('crypto');
const Quote = require('../models/Quote');
const QuoteEvent = require('../models/QuoteEvent');
const Counter = require('../models/Counter');
const CatalogProduct = require('../models/CatalogProduct');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const { QUOTE_EDITABLE_STATUSES } = require('../config/quotes');
const { withComputedTotals } = require('../utils/quoteTotals');

const QUOTE_POPULATE = [
  { path: 'customer', select: 'name email company' },
  { path: 'owner', select: 'name email' },
  { path: 'deal', select: 'title' },
];

/**
 * Teklif numarası üret: TKF-2026-0001
 */
async function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const seq = await Counter.next(`quote-${year}`);
  return `TKF-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * @route   GET /api/quotes
 * @desc    Teklif listesi. Filtre: customer, deal, status, cursor (before), limit.
 */
const getQuotes = async (req, res, next) => {
  try {
    const { customer, deal, status, before, limit: rawLimit } = req.query;
    const filter = {};
    if (customer) filter.customer = customer;
    if (deal) filter.deal = deal;
    if (status) filter.status = status;
    if (before) filter.createdAt = { $lt: new Date(before) };

    const limit = Math.min(parseInt(rawLimit, 10) || 50, 100);

    const quotes = await Quote.find(filter)
      .populate(QUOTE_POPULATE)
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    const hasMore = quotes.length > limit;
    const page = hasMore ? quotes.slice(0, limit) : quotes;
    const nextCursor = hasMore ? page[page.length - 1].createdAt : null;

    res.json({
      success: true,
      data: {
        items: page.map((q) => withComputedTotals(q)),
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/quotes
 * @desc    Teklif oluştur. quoteNumber üretilir. Her item için katalog ürünü
 *          verildiyse fiyat/KDV/isim snapshot'lanır; verilmediyse gövdeden alınır.
 */
const createQuote = async (req, res, next) => {
  try {
    const { customerId, dealId, currency, validUntil, notes, items } = req.body;

    // Müşteri kontrolü
    const customer = await Customer.findById(customerId).select('_id').lean();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Müşteri bulunamadı.' });
    }

    // Deal kontrolü (opsiyonel)
    if (dealId) {
      const deal = await Deal.findById(dealId).select('_id').lean();
      if (!deal) {
        return res.status(404).json({ success: false, error: 'Fırsat bulunamadı.' });
      }
    }

    // Kalemleri hazırla — katalog ürünüyse snapshot'la
    const processedItems = [];
    for (const item of items) {
      if (item.productId) {
        const product = await CatalogProduct.findById(item.productId).lean();
        if (!product) {
          return res.status(404).json({ success: false, error: `Ürün bulunamadı: ${item.productId}` });
        }
        processedItems.push({
          product: product._id,
          name: product.name,
          description: product.description || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice !== undefined ? item.unitPrice : product.unitPrice,
          taxRate: item.taxRate !== undefined ? item.taxRate : product.taxRate,
          discountRate: item.discountRate || 0,
        });
      } else {
        // Serbest satır
        processedItems.push({
          product: null,
          name: item.name,
          description: item.description || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate !== undefined ? item.taxRate : 20,
          discountRate: item.discountRate || 0,
        });
      }
    }

    const quoteNumber = await generateQuoteNumber();

    const quote = await Quote.create({
      quoteNumber,
      customer: customerId,
      deal: dealId || null,
      owner: req.user._id,
      currency: currency || 'TRY',
      validUntil: validUntil || null,
      notes: notes || '',
      items: processedItems,
    });

    await QuoteEvent.create({
      quote: quote._id,
      actor: req.user._id,
      actorName: req.user.name,
      type: 'created',
      note: 'Teklif taslağı oluşturuldu.',
    });

    await quote.populate(QUOTE_POPULATE);
    res.status(201).json({ success: true, data: withComputedTotals(quote) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/quotes/:id
 * @desc    Teklif detayı — populate + withComputedTotals.
 */
const getQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id).populate(QUOTE_POPULATE);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı.' });
    }
    res.json({ success: true, data: withComputedTotals(quote) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/quotes/:id
 * @desc    Teklif güncelle. Sadece status='draft' (QUOTE_EDITABLE_STATUSES).
 */
const updateQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı.' });
    }

    if (!QUOTE_EDITABLE_STATUSES.includes(quote.status)) {
      return res.status(422).json({
        success: false,
        error: 'Gönderilmiş teklif düzenlenemez. Revize seçeneğini kullanın.',
      });
    }

    const { customerId, dealId, currency, validUntil, notes, items } = req.body;

    if (customerId !== undefined) {
      const customer = await Customer.findById(customerId).select('_id').lean();
      if (!customer) {
        return res.status(404).json({ success: false, error: 'Müşteri bulunamadı.' });
      }
      quote.customer = customerId;
    }

    if (dealId !== undefined) {
      if (dealId) {
        const deal = await Deal.findById(dealId).select('_id').lean();
        if (!deal) {
          return res.status(404).json({ success: false, error: 'Fırsat bulunamadı.' });
        }
      }
      quote.deal = dealId || null;
    }

    if (currency !== undefined) quote.currency = currency;
    if (validUntil !== undefined) quote.validUntil = validUntil || null;
    if (notes !== undefined) quote.notes = notes;

    if (items) {
      const processedItems = [];
      for (const item of items) {
        if (item.productId) {
          const product = await CatalogProduct.findById(item.productId).lean();
          if (!product) {
            return res.status(404).json({ success: false, error: `Ürün bulunamadı: ${item.productId}` });
          }
          processedItems.push({
            product: product._id,
            name: product.name,
            description: product.description || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice !== undefined ? item.unitPrice : product.unitPrice,
            taxRate: item.taxRate !== undefined ? item.taxRate : product.taxRate,
            discountRate: item.discountRate || 0,
          });
        } else {
          processedItems.push({
            product: null,
            name: item.name,
            description: item.description || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate !== undefined ? item.taxRate : 20,
            discountRate: item.discountRate || 0,
          });
        }
      }
      quote.items = processedItems;
    }

    try {
      await quote.save();
    } catch (saveError) {
      if (saveError.name === 'VersionError') {
        return res.status(409).json({
          success: false,
          error: 'Bu teklif başka biri tarafından güncellendi. Lütfen sayfayı yenileyin.',
        });
      }
      throw saveError;
    }

    await quote.populate(QUOTE_POPULATE);
    res.json({ success: true, data: withComputedTotals(quote) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/quotes/:id/send
 * @desc    draft→sent. sentAt=now. Sadece draft'tan. publicToken üretir.
 */
const sendQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı.' });
    }
    if (quote.status !== 'draft') {
      return res.status(422).json({ success: false, error: 'Sadece taslak teklifler gönderilebilir.' });
    }

    quote.status = 'sent';
    quote.sentAt = new Date();
    if (!quote.publicToken) {
      quote.publicToken = crypto.randomBytes(24).toString('hex');
    }
    await quote.save();

    await QuoteEvent.create({
      quote: quote._id,
      actor: req.user._id,
      actorName: req.user.name,
      type: 'sent',
      note: 'Teklif müşteriye gönderildi.',
    });

    await quote.populate(QUOTE_POPULATE);
    res.json({ success: true, data: withComputedTotals(quote) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/quotes/:id/revise
 * @desc    version+1 klon; yeni teklif status='draft', supersedes=orijinal,
 *          yeni quoteNumber. Orijinal olduğu gibi kalır.
 */
const reviseQuote = async (req, res, next) => {
  try {
    const original = await Quote.findById(req.params.id).lean();
    if (!original) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı.' });
    }

    const quoteNumber = await generateQuoteNumber();

    // Kalemleri kopyala (_id'leri çıkar ki yeni id'ler oluşsun)
    const clonedItems = (original.items || []).map((item) => {
      const { _id, ...rest } = item;
      return rest;
    });

    const revised = await Quote.create({
      quoteNumber,
      customer: original.customer,
      deal: original.deal,
      owner: req.user._id,
      status: 'draft',
      currency: original.currency,
      validUntil: original.validUntil,
      items: clonedItems,
      notes: original.notes,
      version: (original.version || 1) + 1,
      supersedes: original._id,
    });

    await QuoteEvent.create({
      quote: original._id,
      actor: req.user._id,
      actorName: req.user.name,
      type: 'revised',
      note: `Teklif revize edilerek ${revised.quoteNumber} (v${revised.version}) oluşturuldu.`,
    });

    await QuoteEvent.create({
      quote: revised._id,
      actor: req.user._id,
      actorName: req.user.name,
      type: 'created',
      note: `${original.quoteNumber} teklifinden revize edilerek oluşturuldu.`,
    });

    await revised.populate(QUOTE_POPULATE);
    res.status(201).json({ success: true, data: withComputedTotals(revised) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/quotes/:id/pdf
 * @desc    PDF üret ve stream et (application/pdf).
 */
const getQuotePdf = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id).populate(QUOTE_POPULATE);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı.' });
    }

    const { buildQuoteHtml } = require('../utils/quotePdf');
    const { renderHtmlToPdf } = require('../utils/pdfRenderer');
    const companyProfile = require('../config/companyProfile');

    const quoteData = withComputedTotals(quote);
    const html = buildQuoteHtml(quoteData, companyProfile);
    const pdfBuffer = await renderHtmlToPdf(html);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quote.quoteNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/quotes/:id/events
 * @desc    Teklifin yaşam döngüsü aktivite geçmişi.
 */
const getQuoteEvents = async (req, res, next) => {
  try {
    const events = await QuoteEvent.find({ quote: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/quotes/:id
 * @desc    Sadece draft silinebilir (gönderilmiş teklif iz olarak kalır).
 */
const deleteQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı.' });
    }
    if (quote.status !== 'draft') {
      return res.status(422).json({ success: false, error: 'Sadece taslak teklifler silinebilir.' });
    }

    await Quote.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuotes,
  createQuote,
  getQuote,
  updateQuote,
  sendQuote,
  reviseQuote,
  getQuotePdf,
  getQuoteEvents,
  deleteQuote,
  generateQuoteNumber,
  QUOTE_POPULATE,
};

