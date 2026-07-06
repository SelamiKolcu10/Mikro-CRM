const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Feedback title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    type: {
      type: String,
      enum: ['bug', 'feature', 'improvement'],
      required: [true, 'Feedback type is required'],
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    revenueImpact: {
      type: Number,
      default: 0,
      min: 0,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for sorting by revenue impact (descending) — most used query
feedbackSchema.index({ revenueImpact: -1 });
feedbackSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
