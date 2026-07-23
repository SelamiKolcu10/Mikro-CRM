const { randomUUID } = require('crypto');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const { getInvoicingProvider } = require('../services/invoicing');
const { withComputedTotals } = require('../utils/quoteTotals');
const {
  InvalidRecipientTaxNumberError,
  InsufficientCreditError,
  ValidationError,
  IntegratorUnavailableError,
  AuthenticationError,
} = require('../services/invoicing/errors');

/**
 * Resmî e-Fatura / e-Arşiv kesim controller'ı. Sağlayıcıdan (InvoicingProvider)
 * BAĞIMSIZ — hangi entegratörün kullanıldığını bilmez, yalnız domain hatalarına
 * ve normalize sonuçlara tepki verir. Faturaport bağlanınca burada TEK SATIR
 * değişmez; sadece env `INVOICING_PROVIDER=faturaport` olur.
 */
const INVOICE_POPULATE = [
  { path: 'customer', select: 'name email company taxNumber taxOffice address city district' },
  { path: 'owner', select: 'name email' },
  { path: 'quote', select: 'quoteNumber' },
];

/** Domain hatasını HTTP durumuna çevirir (provider hata dili UI'ya sızmaz). */
function mapDomainErrorToHttp(err) {
  if (err instanceof InvalidRecipientTaxNumberError) return 422;
  if (err instanceof ValidationError) return 422;
  if (err instanceof InsufficientCreditError) return 402;   // kontör bitti
  if (err instanceof AuthenticationError) return 502;
  if (err instanceof IntegratorUnavailableError) return 503;
  return 500;
}

/** Alıcı vergi/adres tamlığı — eksik alan listesini döner. */
function validateRecipient(r) {
  const missing = [];
  const tax = (r.taxNumber || '').replace(/\s/g, '');
  if (!/^\d{10,11}$/.test(tax)) missing.push('VKN/TCKN (10-11 hane)');
  if (tax.length === 10 && !r.taxOffice) missing.push('Vergi Dairesi'); // VKN'de zorunlu
  if (!r.address) missing.push('Adres');
  return missing;
}

/** UI için slim e-fatura görünümü (PDF base64'ü taşımaz). */
function eInvoiceView(invoice) {
  const ei = invoice.eInvoice || {};
  return {
    _id: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    eInvoice: {
      status: ei.status || 'NONE',
      provider: ei.provider || '',
      providerInvoiceId: ei.providerInvoiceId || null,
      officialNumber: ei.officialNumber || null,
      hasPdf: !!ei.pdfBase64,
      error: ei.error || '',
      sentAt: ei.sentAt || null,
      issuedAt: ei.issuedAt || null,
      failedAt: ei.failedAt || null,
    },
  };
}

/**
 * @route POST /api/invoices/:id/einvoice/issue
 * @desc  Satış faturasını resmî olarak kes. Atomik claim ile idempotent:
 *        çift tık / retry ikinci kez göndermez. Senkron başarı ISSUED DEĞİL —
 *        status SENDING; ISSUED poll (refresh) ile kesinleşir.
 */
const issueEInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('customer');
    if (!invoice) return res.status(404).json({ success: false, error: 'Fatura bulunamadı.' });

    const c = invoice.customer || {};
    const body = req.body.recipient || {};
    const recipient = {
      name: body.name || c.company || c.name || '',
      taxNumber: (body.taxNumber || c.taxNumber || '').trim(),
      taxOffice: body.taxOffice || c.taxOffice || '',
      address: body.address || c.address || '',
      city: body.city || c.city || '',
      district: body.district || c.district || '',
      country: 'Türkiye',
    };

    const missing = validateRecipient(recipient);
    if (missing.length) {
      return res.status(422).json({ success: false, error: `Alıcı bilgileri eksik: ${missing.join(', ')}` });
    }

    const computed = withComputedTotals(invoice);
    if (!(computed.grandTotal > 0)) {
      return res.status(422).json({ success: false, error: 'Fatura tutarı geçersiz (0 veya negatif).' });
    }

    // Girilen alıcı bilgisini müşteriye yaz (sonraki kesimlerde ön-doldurma).
    if (c._id) {
      await Customer.updateOne({ _id: c._id }, {
        $set: {
          taxNumber: recipient.taxNumber, taxOffice: recipient.taxOffice,
          address: recipient.address, city: recipient.city, district: recipient.district,
        },
      });
    }

    const provider = getInvoicingProvider();
    const key = randomUUID();

    // ---- ATOMİK CLAIM (idempotency'nin kalbi) ----
    // Yalnız SENDING/ISSUED DEĞİLKEN claim et → NONE, FAILED ve (eski kayıtlarda)
    // eInvoice alanı hiç yoksa da kapsar ($nin eksik alanı da eşler). İki eş
    // zamanlı istek olursa yalnız biri claim eder; diğeri null → 409. Çift
    // fatura İMKANSIZ.
    const claimed = await Invoice.findOneAndUpdate(
      { _id: invoice._id, 'eInvoice.status': { $nin: ['SENDING', 'ISSUED'] } },
      {
        $set: {
          'eInvoice.status': 'SENDING',
          'eInvoice.provider': provider.constructor.name,
          'eInvoice.idempotencyKey': key,
          'eInvoice.recipientSnapshot': recipient,
          'eInvoice.error': '',
          'eInvoice.sentAt': new Date(),
        },
      },
      { new: true }
    );
    if (!claimed) {
      return res.status(409).json({
        success: false,
        error: 'Bu fatura için resmî kesim zaten sürüyor veya tamamlandı.',
      });
    }

    const payload = {
      // Faturaport'ta idempotency alanı yok; lokal guard esas. Yine de izlenebilirlik.
      localReferenceId: `crm-inv-${invoice._id}-${key}`,
      recipient,
      lineItems: (invoice.items || []).map((it) => ({
        name: it.name, quantity: it.quantity, unitPrice: it.unitPrice,
        vatRate: it.taxRate, discountRate: it.discountRate || 0,
      })),
      currency: invoice.currency || 'TRY',
      notes: invoice.notes || '',
      invoiceDate: invoice.issueDate,
    };

    try {
      const result = await provider.issueInvoice(payload);
      const updated = await Invoice.findByIdAndUpdate(
        invoice._id,
        {
          $set: {
            'eInvoice.providerInvoiceId': result.providerInvoiceId,
            'eInvoice.officialNumber': result.invoiceNumber || null,
            'eInvoice.pdfBase64': result.pdfBase64 || null,
            'eInvoice.rawResponse': result.raw, // HAM cevap saklanır
            // status SENDING kalır — ISSUED yalnız poll ile
          },
        },
        { new: true }
      ).populate(INVOICE_POPULATE);
      return res.status(202).json({ success: true, data: eInvoiceView(updated) });
    } catch (err) {
      // Başarısız → FAILED + hata + ham neden sakla. Tekrar denenebilir (NONE/FAILED).
      await Invoice.updateOne({ _id: invoice._id }, {
        $set: {
          'eInvoice.status': 'FAILED',
          'eInvoice.error': err.message,
          'eInvoice.rawResponse': err.cause || null,
          'eInvoice.failedAt': new Date(),
        },
      });
      return res.status(mapDomainErrorToHttp(err)).json({ success: false, error: err.message, code: err.code });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route POST /api/invoices/:id/einvoice/refresh
 * @desc  Poll: entegratörden güncel durumu al, SENDING→ISSUED/FAILED geçir,
 *        resmî fatura no'yu doldur. (Webhook olmadığı için manuel/periyodik poll.)
 */
const refreshEInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Fatura bulunamadı.' });

    const ei = invoice.eInvoice || {};
    if (!ei.providerInvoiceId) {
      return res.status(422).json({ success: false, error: 'Henüz gönderilmiş bir resmî fatura yok.' });
    }
    if (ei.status === 'ISSUED') {
      return res.json({ success: true, data: eInvoiceView(invoice) });
    }

    const provider = getInvoicingProvider();
    try {
      const rec = await provider.getInvoiceRecord(ei.providerInvoiceId);
      if (!rec) return res.json({ success: true, data: eInvoiceView(invoice) }); // hâlâ SENDING

      const patch = { 'eInvoice.rawResponse': rec.raw };
      if (rec.status === 'ISSUED') {
        patch['eInvoice.status'] = 'ISSUED';
        patch['eInvoice.officialNumber'] = rec.invoiceNumber || ei.officialNumber || null;
        patch['eInvoice.issuedAt'] = new Date();
      } else if (rec.status === 'FAILED') {
        patch['eInvoice.status'] = 'FAILED';
        patch['eInvoice.failedAt'] = new Date();
      }
      const updated = await Invoice.findByIdAndUpdate(invoice._id, { $set: patch }, { new: true }).populate(INVOICE_POPULATE);
      return res.json({ success: true, data: eInvoiceView(updated) });
    } catch (err) {
      return res.status(mapDomainErrorToHttp(err)).json({ success: false, error: err.message, code: err.code });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route GET /api/invoices/:id/einvoice/pdf
 * @desc  Resmî faturanın PDF'ini indir (sağlayıcı base64 döndüyse).
 */
const getEInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).select('invoiceNumber eInvoice.pdfBase64');
    if (!invoice || !invoice.eInvoice || !invoice.eInvoice.pdfBase64) {
      return res.status(404).json({ success: false, error: 'Resmî fatura PDF bulunamadı.' });
    }
    const buffer = Buffer.from(invoice.eInvoice.pdfBase64, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="efatura-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = { issueEInvoice, refreshEInvoice, getEInvoicePdf };
