const CatalogProduct = require('../models/CatalogProduct');
const escapeRegex = require('../utils/escapeRegex');

/**
 * @route   GET /api/catalog
 * @desc    Ürün kataloğu listesi. Varsayılan active:true filtresi. Serbest metin
 *          arama (name/description/sku/category). Kategori filtresi.
 */
const getProducts = async (req, res, next) => {
  try {
    const { active, category, q } = req.query;
    const filter = {};

    // Varsayılan: aktif ürünler. ?active=all → hepsini göster (admin/arşiv görünümü).
    if (active === 'all') {
      // filtre yok
    } else if (active === 'false') {
      filter.active = false;
    } else {
      filter.active = true;
    }

    if (category) {
      filter.category = category;
    }

    if (q) {
      const safe = escapeRegex(q);
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { sku: { $regex: safe, $options: 'i' } },
        { category: { $regex: safe, $options: 'i' } },
      ];
    }

    const products = await CatalogProduct.find(filter).sort({ name: 1 });
    res.json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/catalog
 * @desc    Yeni ürün oluştur.
 */
const createProduct = async (req, res, next) => {
  try {
    const { name, description, sku, unitPrice, currency, taxRate, unit, category } = req.body;
    const product = await CatalogProduct.create({
      name,
      description: description || '',
      sku: sku || '',
      unitPrice,
      currency: currency || 'TRY',
      taxRate: taxRate !== undefined ? taxRate : undefined,
      unit: unit || 'piece',
      category: category || '',
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/catalog/:id
 * @desc    Tek ürün detayı.
 */
const getProduct = async (req, res, next) => {
  try {
    const product = await CatalogProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı.' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/catalog/:id
 * @desc    Ürün güncelle (kısmi).
 */
const updateProduct = async (req, res, next) => {
  try {
    const product = await CatalogProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı.' });
    }

    const { name, description, sku, unitPrice, currency, taxRate, unit, category } = req.body;

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (sku !== undefined) product.sku = sku;
    if (unitPrice !== undefined) product.unitPrice = unitPrice;
    if (currency !== undefined) product.currency = currency;
    if (taxRate !== undefined) product.taxRate = taxRate;
    if (unit !== undefined) product.unit = unit;
    if (category !== undefined) product.category = category;

    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/catalog/:id
 * @desc    Ürün arşivle (active:false). Hard delete DEĞİL.
 */
const archiveProduct = async (req, res, next) => {
  try {
    const product = await CatalogProduct.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Ürün bulunamadı.' });
    }

    product.active = false;
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  createProduct,
  getProduct,
  updateProduct,
  archiveProduct,
};
