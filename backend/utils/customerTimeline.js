/**
 * Müşteri birleşik timeline'ının saf birleştirme mantığı — req/res'e bağımlı
 * değil, bu yüzden unit test edilebilir (bkz. tasarım spec'i
 * docs/superpowers/specs/2026-07-22-customer-timeline-design.md §2). Her
 * kaynak kendi şeklinden ortak bir "öğe" şekline map'lenir, tek diziye
 * birleştirilir ve `at` alanına göre azalan sıralanır. Etiket/ikon/renk
 * burada ÜRETİLMEZ — server yalnız yapısal veri döndürür, sunum client'ta
 * (frontend/src/utils/customerTimeline.js) kurulur.
 */

function mapCustomerEvents(customerEvents = []) {
  return customerEvents.map((ev) => ({
    key: `customer:${ev._id}`,
    source: 'customer',
    kind: ev.action,
    at: ev.createdAt,
    actorName: ev.actorName || null,
    note: ev.note || null,
    data: ev.action === 'plan_changed' ? { fromPlan: ev.fromPlan, toPlan: ev.toPlan } : {},
    ref: {},
  }));
}

function mapDealEvents(dealEvents = []) {
  return dealEvents
    .filter((ev) => ev.deal) // deal populate boşsa (silinmişse) atla
    .map((ev) => ({
      key: `deal:${ev._id}`,
      source: 'deal',
      kind: ev.action,
      at: ev.createdAt,
      actorName: ev.actorName || null,
      note: ev.note || null,
      data: {
        dealId: ev.deal._id,
        dealTitle: ev.deal.title,
        dealCurrency: ev.deal.currency,
        fromStage: ev.fromStage,
        toStage: ev.toStage,
        fromValue: ev.fromValue,
        toValue: ev.toValue,
      },
      ref: { dealId: ev.deal._id },
    }));
}

function mapLeadEvents(leadEvents = []) {
  return leadEvents
    .filter((ev) => ev.lead) // lead populate boşsa (silinmişse) atla
    .map((ev) => ({
      key: `lead:${ev._id}`,
      source: 'lead',
      kind: ev.action,
      at: ev.createdAt,
      actorName: ev.actorName || null,
      note: ev.note || null,
      data: {
        leadId: ev.lead._id,
        leadType: ev.lead.type,
        fromStatus: ev.fromStatus,
        toStatus: ev.toStatus,
      },
      ref: { leadId: ev.lead._id },
    }));
}

function mapFeedbacks(feedbacks = []) {
  return feedbacks.map((fb) => ({
    key: `feedback:${fb._id}`,
    source: 'feedback',
    kind: 'feedback_created',
    at: fb.createdAt,
    actorName: null,
    note: fb.description || null,
    data: {
      feedbackId: fb._id,
      feedbackType: fb.type,
      status: fb.status,
      title: fb.title,
    },
    ref: { feedbackId: fb._id },
  }));
}

function mapQuoteEvents(quoteEvents = []) {
  return quoteEvents
    .filter((ev) => ev.quote)
    .map((ev) => ({
      key: `quote:${ev._id}`,
      source: 'quote',
      kind: `quote_${ev.type}`,
      at: ev.createdAt,
      actorName: ev.actorName || null,
      note: ev.note || null,
      data: {
        quoteId: ev.quote._id,
        quoteNumber: ev.quote.quoteNumber,
        grandTotal: ev.quote.grandTotal,
        currency: ev.quote.currency,
        eventType: ev.type,
      },
      ref: { quoteId: ev.quote._id },
    }));
}

/**
 * @param {object} sources
 * @param {Array} sources.customerEvents - CustomerEvent[] (manuel loglar + sistem olayları)
 * @param {Array} sources.dealEvents - DealEvent[], `deal` alanı populate('title') edilmiş olmalı
 * @param {Array} sources.leadEvents - LeadEvent[], `lead` alanı populate('type') edilmiş olmalı
 * @param {Array} sources.quoteEvents - QuoteEvent[], `quote` alanı populate('quoteNumber grandTotal currency') edilmiş olmalı
 * @param {Array} sources.feedbacks - Feedback[]
 * @returns {Array} `at` alanına göre azalan sıralı birleşik timeline öğeleri
 */
function buildTimeline({ customerEvents, dealEvents, leadEvents, quoteEvents, feedbacks } = {}) {
  const items = [
    ...mapCustomerEvents(customerEvents),
    ...mapDealEvents(dealEvents),
    ...mapLeadEvents(leadEvents),
    ...mapQuoteEvents(quoteEvents),
    ...mapFeedbacks(feedbacks),
  ];

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

module.exports = { buildTimeline, mapQuoteEvents };
