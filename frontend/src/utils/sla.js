// Mirrors backend/services/slaEscalationService.js — keep the two in sync.
// 'starter' has no threshold in the original spec (vip/premium/free only);
// 8h, between premium and free, per product decision.
export const SLA_THRESHOLD_MINUTES = {
  vip: 120,
  premium: 240,
  starter: 480,
  free: 1440,
};

export const getSlaThresholdMinutes = (plan) => SLA_THRESHOLD_MINUTES[plan] ?? SLA_THRESHOLD_MINUTES.free;

/**
 * SLA state for a conversation at a given instant, derived purely from
 * elapsed-time-vs-threshold — not from `status`. `status:'escalated'` is the
 * backend daemon's periodic (5-minute) confirmation, not the real-time
 * truth; deriving state independently means the UI shows 'breached' the
 * instant the deadline passes, without waiting on the next sweep, and stays
 * consistent once the daemon does catch up.
 *
 * Only applies while a customer is actually waiting on a reply
 * (lastMessageSenderType === 'customer') — once staff replies this flips to
 * 'internal' and the clock stops, regardless of status.
 *
 * Bands: >50% of the window remaining = ok (silent), ≤50% = warning,
 * ≤15% = critical, past the deadline = breached.
 */
export function getSlaState(conversation, now = Date.now()) {
  if (conversation.lastMessageSenderType !== 'customer' || !conversation.lastMessageAt) {
    return { state: 'ok', minutesRemaining: null, thresholdMinutes: null };
  }

  const thresholdMinutes = getSlaThresholdMinutes(conversation.customer?.plan);
  const elapsedMinutes = (now - new Date(conversation.lastMessageAt).getTime()) / 60000;
  const remainingMinutes = thresholdMinutes - elapsedMinutes;
  const remainingRatio = remainingMinutes / thresholdMinutes;

  if (remainingMinutes <= 0) return { state: 'breached', minutesRemaining: remainingMinutes, thresholdMinutes };
  if (remainingRatio <= 0.15) return { state: 'critical', minutesRemaining: remainingMinutes, thresholdMinutes };
  if (remainingRatio <= 0.5) return { state: 'warning', minutesRemaining: remainingMinutes, thresholdMinutes };
  return { state: 'ok', minutesRemaining: remainingMinutes, thresholdMinutes };
}

/** "1s 42dk" / "12dk" / "<1dk" — no seconds, matches the 30s tick cadence. */
export function formatSlaDuration(minutes) {
  const abs = Math.abs(minutes);
  if (abs < 1) return '<1dk';
  const hours = Math.floor(abs / 60);
  const mins = Math.round(abs % 60);
  if (hours > 0) return mins > 0 ? `${hours}s ${mins}dk` : `${hours}s`;
  return `${mins}dk`;
}
