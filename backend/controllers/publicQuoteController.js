const Quote = require('../models/Quote');
const QuoteEvent = require('../models/QuoteEvent');
const { withComputedTotals } = require('../utils/quoteTotals');
const { notifyQuoteEvent } = require('../utils/quoteNotify');

const PUBLIC_QUOTE_POPULATE = [
  { path: 'customer', select: 'name email company' },
  { path: 'owner', select: 'name email' },
];

/**
 * @route   GET /api/public/quotes/:token
 * @desc    Müşterinin teklifi giriş yapmadan görüntülemesi.
 *          İlk görüntülemede publicViewedAt ve QuoteEvent('viewed') kaydedilir.
 */
const getPublicQuote = async (req, res, next) => {
  try {
    const { token } = req.params;
    const quote = await Quote.findOne({ publicToken: token }).populate(PUBLIC_QUOTE_POPULATE);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı veya süresi dolmuş.' });
    }

    const companyProfile = require('../config/companyProfile');
    const quoteData = withComputedTotals(quote);

    // İlk görüntüleme tespiti
    if (!quote.publicViewedAt && quote.status === 'sent') {
      quote.publicViewedAt = new Date();
      await quote.save();

      const customerName = quote.customer?.name || quote.customer?.company || 'Müşteri';
      await QuoteEvent.create({
        quote: quote._id,
        actor: null,
        actorName: customerName,
        type: 'viewed',
        note: 'Müşteri teklifi public bağlantı üzerinden görüntüledi.',
      });

      notifyQuoteEvent('quote:viewed', quoteData);
    }

    res.json({
      success: true,
      data: {
        quote: quoteData,
        company: companyProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/public/quotes/:token/accept
 * @desc    Müşterinin teklifi onaylaması (status='sent' olmalı).
 *          status -> 'accepted', respondedAt=now, QuoteEvent('accepted'), socket notification.
 */
const acceptPublicQuote = async (req, res, next) => {
  try {
    const { token } = req.params;
    const quote = await Quote.findOne({ publicToken: token }).populate(PUBLIC_QUOTE_POPULATE);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı.' });
    }

    if (quote.status !== 'sent') {
      return res.status(422).json({
        success: false,
        error: `Bu teklif onaylanamaz (mevcut durum: ${quote.status}).`,
      });
    }

    // Geçerlilik tarihi kontrolü
    if (quote.validUntil && new Date() > new Date(quote.validUntil)) {
      quote.status = 'expired';
      await quote.save();
      return res.status(422).json({ success: false, error: 'Teklifin geçerlilik süresi dolmuştur.' });
    }

    quote.status = 'accepted';
    quote.respondedAt = new Date();
    await quote.save();

    const customerName = quote.customer?.name || quote.customer?.company || 'Müşteri';
    await QuoteEvent.create({
      quote: quote._id,
      actor: null,
      actorName: customerName,
      type: 'accepted',
      note: 'Müşteri teklifi onayladı.',
    });

    const quoteData = withComputedTotals(quote);
    notifyQuoteEvent('quote:accepted', quoteData);

    res.json({
      success: true,
      data: quoteData,
      message: 'Teklif başarısıyla onaylandı. Teşekkür ederiz!',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/public/quotes/:token/reject
 * @desc    Müşterinin teklifi reddetmesi (status='sent' olmalı).
 *          status -> 'rejected', rejectionReason, respondedAt=now, QuoteEvent('rejected'), socket notification.
 */
const rejectPublicQuote = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    const quote = await Quote.findOne({ publicToken: token }).populate(PUBLIC_QUOTE_POPULATE);
    if (!quote) {
      return res.status(404).json({ success: false, error: 'Teklif bulunamadı.' });
    }

    if (quote.status !== 'sent') {
      return res.status(422).json({
        success: false,
        error: `Bu teklif yanıtlanamaz (mevcut durum: ${quote.status}).`,
      });
    }

    quote.status = 'rejected';
    quote.rejectionReason = reason || '';
    quote.respondedAt = new Date();
    await quote.save();

    const customerName = quote.customer?.name || quote.customer?.company || 'Müşteri';
    await QuoteEvent.create({
      quote: quote._id,
      actor: null,
      actorName: customerName,
      type: 'rejected',
      note: reason ? `Red Nedeni: ${reason}` : 'Müşteri teklifi reddetti.',
    });

    const quoteData = withComputedTotals(quote);
    notifyQuoteEvent('quote:rejected', quoteData);

    res.json({
      success: true,
      data: quoteData,
      message: 'Geri bildiriminiz için teşekkür ederiz.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicQuote,
  acceptPublicQuote,
  rejectPublicQuote,
};
