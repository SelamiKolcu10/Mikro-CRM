/**
 * Frontend kopyası — backend/config/quotes.js ile senkron tutulmalı.
 */
export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
export const QUOTE_EDITABLE_STATUSES = ['draft'];

export const QUOTE_STATUS_CLASS = {
  draft: 'quote-status--draft',
  sent: 'quote-status--sent',
  accepted: 'quote-status--accepted',
  rejected: 'quote-status--rejected',
  expired: 'quote-status--expired',
};
