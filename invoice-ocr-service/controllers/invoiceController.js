const Invoice = require('../models/Invoice');
const { validateInvoice } = require('../utils/vatCalculator');
const { validateUploadedFiles, validateInvoiceData } = require('../utils/validators');
const ocrService = require('../services/ocrService');

/**
 * POST /api/invoices/upload
 * Upload and process a single invoice image/PDF
 */
exports.uploadSingleInvoice = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi.' });
    }

    // Validate file
    const fileValidation = validateUploadedFiles(req.file);
    if (!fileValidation.valid) {
      return res.status(400).json({ success: false, errors: fileValidation.errors });
    }

    // Process with OCR/AI
    const parsed = await ocrService.processInvoice(req.file.path, req.file.mimetype);

    // Validate parsed data
    const dataValidation = validateInvoiceData(parsed);
    if (!dataValidation.valid) {
      // Save with pending status if AI output is malformed
      const invoice = await Invoice.create({
        originalFileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        validationStatus: 'pending',
        validationMessage: dataValidation.errors.join('; '),
        confidenceScore: parsed.confidenceScore || 0,
      });
      return res.status(200).json({ success: true, data: invoice });
    }

    // Run mathematical validation
    const validated = validateInvoice(parsed.lineItems, parsed.grandTotal);

    // Save to database
    const invoice = await Invoice.create({
      vendorName: parsed.vendorName || '',
      vendorTaxNumber: parsed.vendorTaxNumber || '',
      invoiceNumber: parsed.invoiceNumber || '',
      invoiceDate: parsed.invoiceDate || null,
      lineItems: validated.lineItems,
      vatSummary: validated.vatSummary,
      totalBase: validated.totals.totalBase,
      totalVat: validated.totals.totalVat,
      grandTotal: validated.totals.grandTotal,
      validationStatus: validated.validation.status,
      validationMessage: validated.validation.message,
      confidenceScore: parsed.confidenceScore || 0,
      originalFileName: req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/invoices/bulk-upload
 * Upload and process multiple invoices (10-20)
 */
exports.bulkUploadInvoices = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi.' });
    }

    // Validate files
    const fileValidation = validateUploadedFiles(req.files);
    if (!fileValidation.valid) {
      return res.status(400).json({ success: false, errors: fileValidation.errors });
    }

    const results = [];

    // Process each file with real OpenAI OCR
    for (const file of req.files) {
      try {
        const parsed = await ocrService.processInvoice(file.path, file.mimetype);
        const dataValidation = validateInvoiceData(parsed);

        if (!dataValidation.valid) {
          const invoice = await Invoice.create({
            originalFileName: file.originalname,
            fileUrl: `/uploads/${file.filename}`,
            validationStatus: 'pending',
            validationMessage: dataValidation.errors.join('; '),
            confidenceScore: parsed.confidenceScore || 0,
          });
          results.push({ file: file.originalname, status: 'pending', data: invoice });
          continue;
        }

        const validated = validateInvoice(parsed.lineItems, parsed.grandTotal);

        const invoice = await Invoice.create({
          vendorName: parsed.vendorName || '',
          vendorTaxNumber: parsed.vendorTaxNumber || '',
          invoiceNumber: parsed.invoiceNumber || '',
          invoiceDate: parsed.invoiceDate || null,
          lineItems: validated.lineItems,
          vatSummary: validated.vatSummary,
          totalBase: validated.totals.totalBase,
          totalVat: validated.totals.totalVat,
          grandTotal: validated.totals.grandTotal,
          validationStatus: validated.validation.status,
          validationMessage: validated.validation.message,
          confidenceScore: parsed.confidenceScore || 0,
          originalFileName: file.originalname,
          fileUrl: `/uploads/${file.filename}`,
        });

        results.push({ file: file.originalname, status: validated.validation.status, data: invoice });
      } catch (fileError) {
        results.push({ file: file.originalname, status: 'error', error: fileError.message });
      }
    }

    const summary = {
      total: results.length,
      verified: results.filter(r => r.status === 'verified').length,
      mismatch: results.filter(r => r.status === 'mismatch').length,
      pending: results.filter(r => r.status === 'pending').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    res.status(201).json({ success: true, summary, results });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices
 * List all invoices with pagination and filtering
 */
exports.getAllInvoices = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.status) filter.validationStatus = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { vendorName: { $regex: req.query.search, $options: 'i' } },
        { invoiceNumber: { $regex: req.query.search, $options: 'i' } },
        { originalFileName: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices/:id
 * Get single invoice detail with full VAT breakdown
 */
exports.getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Fatura bulunamadı.' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/invoices/:id
 * Manual correction for mismatch cases
 */
exports.updateInvoice = async (req, res, next) => {
  try {
    const { lineItems, grandTotal, vendorName, vendorTaxNumber, invoiceNumber, invoiceDate } = req.body;

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Fatura bulunamadı.' });
    }

    // If line items are being updated, re-run validation
    if (lineItems && lineItems.length > 0) {
      const reportedTotal = grandTotal || invoice.grandTotal;
      const validated = validateInvoice(lineItems, reportedTotal);

      invoice.lineItems = validated.lineItems;
      invoice.vatSummary = validated.vatSummary;
      invoice.totalBase = validated.totals.totalBase;
      invoice.totalVat = validated.totals.totalVat;
      invoice.grandTotal = validated.totals.grandTotal;
      invoice.validationStatus = validated.validation.status;
      invoice.validationMessage = validated.validation.message;
    }

    // Update metadata fields
    if (vendorName !== undefined) invoice.vendorName = vendorName;
    if (vendorTaxNumber !== undefined) invoice.vendorTaxNumber = vendorTaxNumber;
    if (invoiceNumber !== undefined) invoice.invoiceNumber = invoiceNumber;
    if (invoiceDate !== undefined) invoice.invoiceDate = invoiceDate;

    await invoice.save();

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/invoices/:id
 */
exports.deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Fatura bulunamadı.' });
    }
    res.json({ success: true, message: 'Fatura silindi.' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/invoices/stats/summary
 * Processing statistics
 */
exports.getInvoiceStats = async (req, res, next) => {
  try {
    const [total, verified, mismatch, pending] = await Promise.all([
      Invoice.countDocuments(),
      Invoice.countDocuments({ validationStatus: 'verified' }),
      Invoice.countDocuments({ validationStatus: 'mismatch' }),
      Invoice.countDocuments({ validationStatus: 'pending' }),
    ]);

    // Aggregation for totals
    const totals = await Invoice.aggregate([
      { $match: { validationStatus: 'verified' } },
      {
        $group: {
          _id: null,
          totalBase: { $sum: '$totalBase' },
          totalVat: { $sum: '$totalVat' },
          grandTotal: { $sum: '$grandTotal' },
          avgConfidence: { $avg: '$confidenceScore' },
        },
      },
    ]);

    const stats = totals[0] || { totalBase: 0, totalVat: 0, grandTotal: 0, avgConfidence: 0 };

    res.json({
      success: true,
      data: {
        counts: { total, verified, mismatch, pending },
        accuracy: total > 0 ? Math.round((verified / total) * 100) : 0,
        financials: {
          totalBase: Math.round(stats.totalBase * 100) / 100,
          totalVat: Math.round(stats.totalVat * 100) / 100,
          grandTotal: Math.round(stats.grandTotal * 100) / 100,
        },
        avgConfidence: Math.round(stats.avgConfidence || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};
