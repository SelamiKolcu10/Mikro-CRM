/**
 * Frontend kopyası — backend/config/deals.js ile senkron tutulmalı (stage↔
 * olasılık eşleşmesi birebir aynı olmalı). config/leads.js ile aynı desen:
 * board bileşenleri (DealBoard/DealCard/Drawer) tek kaynak olarak buradan okur.
 */
export const DEAL_STAGES = ['initial_contact', 'meeting', 'proposal', 'negotiation', 'won', 'lost'];

// Sürükle-bırak kolonları — won/lost ayrı görünse de aynı board'da; kolon sırası budur.
export const DEAL_STAGE_PROBABILITY = {
  initial_contact: 10,
  meeting: 30,
  proposal: 50,
  negotiation: 70,
  won: 100,
  lost: 0,
};

export const OPEN_STAGES = ['initial_contact', 'meeting', 'proposal', 'negotiation'];
export const CLOSED_STAGES = ['won', 'lost'];

export const DEAL_CURRENCIES = ['TRY', 'USD', 'EUR'];

// Aşama renk sistemi — hem kolon başlığı hem kart kenarı hem timeline chip'i
// aynı sınıfları kullanır. Renkler index.css'te .deal-stage--* altında. Renk
// tek başına anlam taşımaz; her zaman metin etiketiyle birlikte (WCAG).
export const DEAL_STAGE_CLASS = {
  initial_contact: 'deal-stage--initial_contact',
  meeting: 'deal-stage--meeting',
  proposal: 'deal-stage--proposal',
  negotiation: 'deal-stage--negotiation',
  won: 'deal-stage--won',
  lost: 'deal-stage--lost',
};

export const CURRENCY_SYMBOL = { TRY: '₺', USD: '$', EUR: '€' };
