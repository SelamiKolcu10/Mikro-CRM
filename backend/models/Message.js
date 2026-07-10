const mongoose = require('mongoose');

/**
 * `senderName`/`senderRole` are denormalized at write time — CustomerUser
 * has no `name` field of its own (it borrows the Customer's), and re-joining
 * through Customer/User on every history fetch just to render a label isn't
 * worth it for data that never changes after the message is sent.
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderType: {
      type: String,
      enum: ['internal', 'customer'],
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: [true, 'Mesaj boş olamaz.'],
      trim: true,
      maxlength: [2000, 'Mesaj 2000 karakteri geçemez.'],
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
