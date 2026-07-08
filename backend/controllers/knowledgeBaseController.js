const KnowledgeArticle = require('../models/KnowledgeArticle');

/**
 * @route   GET /api/knowledge-base
 */
const getArticles = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (search) filter.$text = { $search: search };

    const articles = await KnowledgeArticle.find(filter)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort('-updatedAt');

    res.json({ success: true, data: articles });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/knowledge-base/:id
 */
const getArticle = async (req, res, next) => {
  try {
    const article = await KnowledgeArticle.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!article) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı.' });
    }

    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/knowledge-base
 */
const createArticle = async (req, res, next) => {
  try {
    const { title, content, category } = req.body;

    const article = await KnowledgeArticle.create({
      title,
      content,
      category,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/knowledge-base/:id
 */
const updateArticle = async (req, res, next) => {
  try {
    const { title, content, category } = req.body;

    const article = await KnowledgeArticle.findByIdAndUpdate(
      req.params.id,
      { title, content, category, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );

    if (!article) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı.' });
    }

    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/knowledge-base/:id
 */
const deleteArticle = async (req, res, next) => {
  try {
    const article = await KnowledgeArticle.findByIdAndDelete(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, error: 'Döküman bulunamadı.' });
    }
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

module.exports = { getArticles, getArticle, createArticle, updateArticle, deleteArticle };
