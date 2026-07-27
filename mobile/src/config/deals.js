// Deal stage labels + colors, shared by the deals list and detail screens.
// Mirrors backend config/deals.js stage set.
export const STAGE_LABEL = {
  initial_contact: 'İlk Temas',
  meeting: 'Görüşme',
  proposal: 'Teklif',
  negotiation: 'Müzakere',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
};

export const DEAL_STAGES = Object.keys(STAGE_LABEL);
export const OPEN_STAGES = ['initial_contact', 'meeting', 'proposal', 'negotiation'];

export const STAGE_STYLE = {
  initial_contact: { fg: '#0EA5E9', bg: '#E0F2FE' },
  meeting: { fg: '#6366F1', bg: '#E7E9FE' },
  proposal: { fg: '#8B5CF6', bg: '#EDE9FE' },
  negotiation: { fg: '#F59E0B', bg: '#FEF3E2' },
  won: { fg: '#16A34A', bg: '#E7F6EC' },
  lost: { fg: '#EF4444', bg: '#FDECEC' },
};
