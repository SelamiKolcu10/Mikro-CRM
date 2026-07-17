const mongoose = require('mongoose');

/**
 * One conversation thread per customer — a separate channel from Feedback
 * (support tickets), per product decision: chat is for live back-and-forth,
 * tickets are for tracked work items. `assignedTo` is soft ownership only —
 * any support/staff account can read and respond regardless of assignment;
 * it exists so a super_admin can see who's "on" a given customer.
 */
const conversationSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    lastMessagePreview: {
      type: String,
      default: '',
    },
    // Denormalized counters instead of per-message read receipts — cheap to
    // maintain (increment on send, zero on read) and all either side's
    // unread badge needs.
    unreadByInternal: {
      type: Number,
      default: 0,
    },
    unreadByCustomer: {
      type: Number,
      default: 0,
    },
    // SLA clock: "customer is waiting on a reply" iff lastMessageSenderType
    // === 'customer'. Combined with lastMessageAt above, this is the whole
    // clock — no separate awaitingSince field needed. Set by
    // chatController.sendMessage ('internal') and
    // portalChatController.sendMyMessage ('customer').
    lastMessageSenderType: {
      type: String,
      enum: ['internal', 'customer'],
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'escalated'],
      default: 'active',
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    // Snapshot of assignedTo at the moment escalation revoked it — display
    // only ("was assigned to X before escalating"), not restored automatically.
    previousAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Matches the SLA daemon's exact query shape (status + senderType + non-null
// lastMessageAt) so checkEscalations doesn't collection-scan every run.
conversationSchema.index({ status: 1, lastMessageSenderType: 1, lastMessageAt: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
