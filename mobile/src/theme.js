// Design tokens — the single source of truth for the mobile UI. Screens read
// from here instead of hard-coding colors/sizes, so the whole app stays
// consistent (frontend-design: establish a design language in one place).
//
// Direction: one blue accent, neutral grays for structure, a single radius
// scale. Restrained on purpose — reads as "designed", not "generated".
export const colors = {
  primary: '#2C43E0', // royal-blue accent — primary actions, links, active
  primaryDark: '#2135B8', // pressed state
  primarySoft: '#EAEDFD', // tint — focus ring, subtle fills
  bg: '#EEF1F7', // page background (cool light gray)
  surface: '#FFFFFF', // inputs, cards
  text: '#1B2130', // near-black, not pure #000
  textMuted: '#6B7280', // secondary text
  textFaint: '#9AA1AE', // placeholders, icon hints
  border: '#E1E5EE', // input / card borders
  borderStrong: '#D3D8E4',
  danger: '#EF4444',
  dangerSoft: '#FDECEC',
  success: '#16A34A',
  successSoft: '#E7F6EC',
  warnSoft: '#FEF3E2',
  // Lead temperature accents (used by LeadsScreen)
  hot: '#EF4444',
  warm: '#F59E0B',
  cold: '#3B82F6',
};

// Categorical palette for charts (donut segments, etc.) — distinct hues, used
// consistently across the dashboard.
export const chartColors = ['#94A3B8', '#38BDF8', '#6366F1', '#F59E0B'];

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const font = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 26 };

export const tempColor = (temperature) =>
  ({ hot: colors.hot, warm: colors.warm, cold: colors.cold }[temperature] || colors.textMuted);
