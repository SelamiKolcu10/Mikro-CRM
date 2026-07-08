const mongoose = require('mongoose');

const knowledgeArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      maxlength: [10000, 'Content cannot exceed 10000 characters'],
    },
    category: {
      type: String,
      trim: true,
      default: 'Genel',
      maxlength: [50, 'Category cannot exceed 50 characters'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

knowledgeArticleSchema.index({ category: 1 });
knowledgeArticleSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);
