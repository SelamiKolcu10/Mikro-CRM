const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Customer = require('../models/Customer');
const { getIO, STAFF_ROOM, conversationRoom } = require('../socket');

const MESSAGE_HISTORY_LIMIT = 200;
const PREVIEW_LENGTH = 120;

// A customer has exactly one conversation with the company — find it, or
// lazily create it on whichever request touches chat first (GET or POST).
async function findOrCreateConversation(customerId) {
  let conversation = await Conversation.findOne({ customer: customerId });
  if (!conversation) {
    conversation = await Conversation.create({ customer: customerId });
  }
  return conversation;
}

/**
 * @route   GET /api/portal/chat/messages
 */
const getMyMessages = async (req, res, next) => {
  try {
    const conversation = await findOrCreateConversation(req.customerId);
    const messages = await Message.find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .limit(MESSAGE_HISTORY_LIMIT);

    res.json({ success: true, data: { conversation, messages: messages.reverse() } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/portal/chat/messages
 */
const sendMyMessage = async (req, res, next) => {
  try {
    const conversation = await findOrCreateConversation(req.customerId);
    const customer = await Customer.findById(req.customerId).select('name');

    const message = await Message.create({
      conversation: conversation._id,
      senderType: 'customer',
      sender: req.customerUser._id,
      senderName: customer?.name || req.customerUser.email,
      body: req.body.body,
    });

    // $inc instead of read-modify-save — two messages landing in the same
    // instant must both count, not clobber each other's unread bump.
    // lastMessageSenderType: 'customer' starts/restarts the SLA clock (see
    // backend/services/slaEscalationService.js) — a still-escalated
    // conversation stays escalated until staff actually replies.
    const updated = await Conversation.findByIdAndUpdate(
      conversation._id,
      {
        $set: {
          lastMessageAt: message.createdAt,
          lastMessagePreview: message.body.slice(0, PREVIEW_LENGTH),
          lastMessageSenderType: 'customer',
        },
        $inc: { unreadByInternal: 1 },
      },
      { new: true }
    );

    const payload = { ...message.toObject(), clientId: req.body.clientId };

    const io = getIO();
    io.to(conversationRoom(conversation._id)).emit('message:new', payload);
    io.to(STAFF_ROOM).emit('conversation:updated', {
      conversationId: conversation._id,
      lastMessageAt: updated.lastMessageAt,
      lastMessagePreview: updated.lastMessagePreview,
    });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/portal/chat/read
 */
const markMyRead = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOneAndUpdate(
      { customer: req.customerId },
      { unreadByCustomer: 0 },
      { new: true }
    );
    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyMessages, sendMyMessage, markMyRead };
