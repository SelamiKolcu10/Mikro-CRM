/**
 * Deal / Fırsat Pipeline sabitleri — tek kaynak (bkz. config/leads.js deseni).
 * Hem model şeması, hem validators, hem forecast util'i buradan okur; ikinci
 * bir kopya tutmak stage↔olasılık eşleşmesinde drift riski yaratır.
 * Tasarım: docs/superpowers/specs/2026-07-21-deal-pipeline-design.md §1.1
 */
const DEAL_STAGES = ['initial_contact', 'meeting', 'proposal', 'negotiation', 'won', 'lost'];

// Aşamaya göre VARSAYILAN kazanma olasılığı — stage değişince uygulanır
// (bkz. dealController.updateDealStage). Kullanıcı sonradan PATCH /:id ile
// deal bazında override edebilir. weightedValue forecast'ı bu yüzdeyi kullanır.
const DEAL_STAGE_PROBABILITY = {
  initial_contact: 10,
  meeting: 30,
  proposal: 50,
  negotiation: 70,
  won: 100,
  lost: 0,
};

// Açık (pipeline'da hâlâ dönen) vs kapalı (won/lost) aşamalar — forecast ve
// isOpen türevi bu ayrımdan hesaplanır.
const OPEN_STAGES = ['initial_contact', 'meeting', 'proposal', 'negotiation'];
const CLOSED_STAGES = ['won', 'lost'];

// Multi-currency İLERİDE (roadmap infra) — v1 pratikte hep TRY, ama alan baştan
// var ki sonradan migration gerekmesin. Kur dönüşümü/gösterimi henüz yok.
const DEAL_CURRENCIES = ['TRY', 'USD', 'EUR'];

module.exports = {
  DEAL_STAGES,
  DEAL_STAGE_PROBABILITY,
  OPEN_STAGES,
  CLOSED_STAGES,
  DEAL_CURRENCIES,
};
