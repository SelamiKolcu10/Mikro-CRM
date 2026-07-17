const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Feedback = require('../models/Feedback');
const Customer = require('../models/Customer');
const { getIO, STAFF_ROOM, conversationRoom } = require('../socket');

const MESSAGE_HISTORY_LIMIT = 200;
const PREVIEW_LENGTH = 120;

/**
 * @route   GET /api/chat/conversations
 * @desc    Inbox list for staff/support — every customer, not just the ones
 *          who've already messaged, so staff can open and start a chat with
 *          anyone. Customers with no Conversation yet get placeholder fields
 *          (no id, no history) and sort after the ones with real activity.
 */
const getConversations = async (req, res, next) => {
  try {
    const [customers, conversations] = await Promise.all([
      Customer.find().select('name email company plan mrr createdAt'),
      Conversation.find().populate('assignedTo', 'name email'),
    ]);

    const conversationByCustomer = new Map(conversations.map((c) => [c.customer.toString(), c]));

    const customerIds = customers.map((c) => c._id);
    const [openCounts, totalCounts] = await Promise.all([
      Feedback.aggregate([
        { $match: { customer: { $in: customerIds }, status: { $in: ['open', 'in-progress'] } } },
        { $group: { _id: '$customer', count: { $sum: 1 } } },
      ]),
      Feedback.aggregate([
        { $match: { customer: { $in: customerIds } } },
        { $group: { _id: '$customer', count: { $sum: 1 } } },
      ]),
    ]);
    const openCountMap = new Map(openCounts.map((row) => [row._id.toString(), row.count]));
    // Distinct from openFeedbackCount — a customer whose only tickets are
    // already resolved/closed has openFeedbackCount 0 but totalFeedbackCount
    // > 0. The UI needs both so "no open ticket" doesn't read as "no ticket
    // ever existed" (see totalCountMap usage below).
    const totalCountMap = new Map(totalCounts.map((row) => [row._id.toString(), row.count]));

    const data = customers
      .map((customer) => {
        const conversation = conversationByCustomer.get(customer._id.toString());
        return {
          _id: conversation?._id || null,
          customer: customer.toObject(),
          assignedTo: conversation?.assignedTo || null,
          lastMessageAt: conversation?.lastMessageAt || null,
          lastMessagePreview: conversation?.lastMessagePreview || '',
          unreadByInternal: conversation?.unreadByInternal || 0,
          openFeedbackCount: openCountMap.get(customer._id.toString()) || 0,
          totalFeedbackCount: totalCountMap.get(customer._id.toString()) || 0,
        };
      })
      .sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return (a.customer.name || '').localeCompare(b.customer.name || '');
      });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/chat/escalations
 * @desc    Currently escalated conversations — initial-load source for the
 *          sidebar badge and EscalationBanner (live updates after that come
 *          from the 'conversation:escalated' socket event, not polling).
 */
const getEscalations = async (req, res, next) => {
  try {
    const escalations = await Conversation.find({ status: 'escalated' })
      .populate('customer', 'name email company plan')
      .populate('previousAssignee', 'name email')
      .sort('-escalatedAt');
    res.json({ success: true, data: escalations });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/chat/conversations/start
 * @desc    Staff-initiated equivalent of the portal's lazy
 *          findOrCreateConversation — lets a support agent open a chat with
 *          a customer who hasn't messaged yet. Idempotent: calling it again
 *          for the same customer just returns the existing conversation.
 */
const startConversation = async (req, res, next) => {
  try {
    const { customerId } = req.body;
    const customer = await Customer.findById(customerId).select('_id');
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Müşteri bulunamadı.' });
    }

    let conversation = await Conversation.findOne({ customer: customerId });
    if (!conversation) {
      conversation = await Conversation.create({ customer: customerId });
    }
    await conversation.populate('assignedTo', 'name email');

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/chat/conversations/:id/messages
 */
const getMessages = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Sohbet bulunamadı.' });
    }

    const messages = await Message.find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .limit(MESSAGE_HISTORY_LIMIT);

    res.json({ success: true, data: { conversation, messages: messages.reverse() } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/chat/conversations/:id/messages
 * @desc    Staff reply. Persists first (source of truth), then pushes over
 *          the socket — if the push fails the message still exists and
 *          shows up on the recipient's next fetch, it just isn't instant.
 */
const sendMessage = async (req, res, next) => {
  try {
    const existing = await Conversation.findById(req.params.id).select('status');
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Sohbet bulunamadı.' });
    }

    const message = await Message.create({
      conversation: req.params.id,
      senderType: 'internal',
      sender: req.user._id,
      senderName: req.user.name,
      body: req.body.body,
    });

    // A staff reply resolves the SLA clock (lastMessageSenderType flips away
    // from 'customer') and, if the conversation was escalated, un-escalates
    // it — the replier auto-claims it rather than leaving assignedTo empty.
    const update = {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: message.body.slice(0, PREVIEW_LENGTH),
        lastMessageSenderType: 'internal',
      },
      $inc: { unreadByCustomer: 1 },
    };
    if (existing.status === 'escalated') {
      Object.assign(update.$set, {
        status: 'active',
        escalatedAt: null,
        previousAssignee: null,
        assignedTo: req.user._id,
      });
    }

    // $inc instead of read-modify-save — two replies landing in the same
    // instant must both count, not clobber each other's unread bump.
    const conversation = await Conversation.findByIdAndUpdate(req.params.id, update, { new: true });

    // clientId is echoed, never persisted — it's how the sender's own UI
    // reconciles its optimistic bubble whichever of REST/socket arrives first.
    const payload = { ...message.toObject(), clientId: req.body.clientId };

    const io = getIO();
    io.to(conversationRoom(conversation._id)).emit('message:new', payload);
    io.to(STAFF_ROOM).emit('conversation:updated', {
      conversationId: conversation._id,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
    });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/chat/conversations/:id/read
 */
const markRead = async (req, res, next) => {
  try {
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { unreadByInternal: 0 },
      { new: true }
    );
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Sohbet bulunamadı.' });
    }
    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/chat/conversations/:id/assign
 * @desc    Soft ownership only — assignment doesn't restrict who can read or
 *          reply, it just tells the team (and super_admin) who's on it.
 */
const assignConversation = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { assignedTo: userId || null },
      { new: true }
    ).populate('assignedTo', 'name email');
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Sohbet bulunamadı.' });
    }
    res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

module.exports = { getConversations, getEscalations, startConversation, getMessages, sendMessage, markRead, assignConversation };
