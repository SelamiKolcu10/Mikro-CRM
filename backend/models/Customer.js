const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Customer email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    company: {
      type: String,
      trim: true,
      default: '',
    },
    plan: {
      type: String,
      enum: ['free', 'starter', 'premium', 'vip'],
      default: 'free',
      required: true,
    },
    mrr: {
      type: Number,
      default: 0,
      min: [0, 'MRR cannot be negative'],
    },
    source: {
      type: String,
      enum: ['twitter', 'discord', 'email', 'in-app', 'other'],
      default: 'email',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Virtual: get feedback count for this customer
customerSchema.virtual('feedbacks', {
  ref: 'Feedback',
  localField: '_id',
  foreignField: 'customer',
});

// Ensure virtuals are included in JSON output
customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Customer', customerSchema);
