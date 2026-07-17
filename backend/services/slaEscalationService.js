const cron = require('node-cron');
const Conversation = require('../models/Conversation');
require('../models/Customer'); // registered for .populate('customer', ...) below — this module must not depend on require order elsewhere
const { getIO, STAFF_ROOM } = require('../socket');

// Per-tier response-time budget. 'starter' has no threshold in the original
// spec (which only named vip/premium/free) — set to 8h, between premium and
// free, per product decision.
const SLA_THRESHOLD_MINUTES = {
  vip: 120,
  premium: 240,
  starter: 480,
  free: 1440,
};

function getSlaThresholdMinutes(plan) {
  return SLA_THRESHOLD_MINUTES[plan] ?? SLA_THRESHOLD_MINUTES.free;
}

/**
 * Scans conversations where a customer is waiting on a reply
 * (lastMessageSenderType === 'customer') and escalates any that have
 * exceeded their tier's SLA window: revokes assignment, flips status, and
 * pushes a live event to every connected staff socket. Idempotent by
 * construction — only status:'active' conversations are ever matched, so an
 * already-escalated conversation is never re-emitted.
 */
async function checkEscalations() {
  const now = Date.now();
  const waiting = await Conversation.find({
    status: 'active',
    lastMessageSenderType: 'customer',
    lastMessageAt: { $ne: null },
  }).populate('customer', 'plan name');

  const io = getIO();

  for (const conversation of waiting) {
    if (!conversation.customer) continue; // orphaned conversation — nothing to escalate against

    const thresholdMinutes = getSlaThresholdMinutes(conversation.customer.plan);
    const minutesWaiting = (now - conversation.lastMessageAt.getTime()) / 60000;
    if (minutesWaiting <= thresholdMinutes) continue;

    const previousAssignee = conversation.assignedTo;
    const escalatedAt = new Date();

    await Conversation.findByIdAndUpdate(conversation._id, {
      status: 'escalated',
      escalatedAt,
      assignedTo: null,
      previousAssignee,
    });

    io.to(STAFF_ROOM).emit('conversation:escalated', {
      conversationId: conversation._id,
      customerId: conversation.customer._id,
      customerName: conversation.customer.name,
      plan: conversation.customer.plan,
      minutesOverdue: Math.round(minutesWaiting - thresholdMinutes),
      escalatedAt,
    });
  }
}

/**
 * Runs one immediate check (covers conversations that breached while the
 * server was down) then schedules the recurring 5-minute sweep.
 */
function start() {
  checkEscalations().catch((err) => console.error('SLA escalation kontrolü başarısız (başlangıç):', err.message));
  cron.schedule('*/5 * * * *', () => {
    checkEscalations().catch((err) => console.error('SLA escalation kontrolü başarısız:', err.message));
  });
}

module.exports = { start, checkEscalations, getSlaThresholdMinutes, SLA_THRESHOLD_MINUTES };
