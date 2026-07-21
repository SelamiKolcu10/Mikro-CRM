/**
 * Frontend kopyası — backend/config/leads.js ile senkron tutulmalı.
 * pages/LeadForm.jsx (public form) VE utils/leadSummary.js + panel
 * bileşenleri (Leads.jsx/LeadDetailDrawer) aynı listeleri buradan okur —
 * çift tanım yerine tek kaynak.
 */
export const LEAD_STATUSES = ['new', 'in_review', 'contacted', 'quoted', 'won', 'lost'];

export const BUDGET_OPTIONS = [
  { value: '<50k', labelKey: 'leads.form.budgets.under50k' },
  { value: '50k-150k', labelKey: 'leads.form.budgets.b50to150k' },
  { value: '150k-500k', labelKey: 'leads.form.budgets.b150to500k' },
  { value: '500k+', labelKey: 'leads.form.budgets.over500k' },
  { value: 'belirtilmemis', labelKey: 'leads.form.budgets.unspecified' },
];

export const TIMEFRAME_OPTIONS = [
  { value: 'hemen', labelKey: 'leads.form.timeframes.hemen' },
  { value: '1_ay_icinde', labelKey: 'leads.form.timeframes.withinMonth' },
  { value: '1_3_ay', labelKey: 'leads.form.timeframes.oneToThreeMonths' },
  { value: 'belirsiz', labelKey: 'leads.form.timeframes.unsure' },
];

// Durum renk sistemi — tek kaynak, hem liste satırları (Leads.jsx) hem detay
// drawer'ı (LeadDetailDrawer) aynı sınıfları kullanır. Renkler CSS'te
// .lead-status--* altında tanımlı (bkz. index.css). Renk tek başına anlam
// taşımıyor — rozet her zaman metin etiketiyle birlikte (WCAG).
export const LEAD_STATUS_CLASS = {
  new: 'lead-status--new',
  in_review: 'lead-status--in_review',
  contacted: 'lead-status--contacted',
  quoted: 'lead-status--quoted',
  won: 'lead-status--won',
  lost: 'lead-status--lost',
};

export const LEAD_TEMPERATURE_CLASS = {
  hot: 'lead-temp--hot',
  warm: 'lead-temp--warm',
  cold: 'lead-temp--cold',
};

export function budgetLabelKey(value) {
  return BUDGET_OPTIONS.find((o) => o.value === value)?.labelKey || null;
}

export function timeframeLabelKey(value) {
  return TIMEFRAME_OPTIONS.find((o) => o.value === value)?.labelKey || null;
}
