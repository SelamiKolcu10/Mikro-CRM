// Serbest/genel e-posta sağlayıcıları — bunların dışındaki her domain
// "kurumsal e-posta" sayılır (bkz. spec §5). Küçük, sınırlı bir liste;
// amaç kesin doğruluk değil, ucuz bir sinyal.
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com',
  'icloud.com', 'protonmail.com', 'live.com', 'msn.com',
]);

const HIGH_BUDGET_RANGES = new Set(['150k-500k', '500k+']);
const NEAR_TERM_TIMEFRAMES = new Set(['hemen', '1_ay_icinde']);

function isCorporateEmail(email) {
  const domain = (email || '').split('@')[1]?.toLowerCase();
  return !!domain && !FREE_EMAIL_DOMAINS.has(domain);
}

/**
 * Kural-tabanlı, deterministik lead skorlama (bkz. spec §5). Saf fonksiyon —
 * DB/DOM bağımsız, tek başına test edilebilir. Skor ingestion anında
 * hesaplanıp Lead.score/temperature olarak SAKLANIR (models/Lead.js'teki
 * gerekçe: statik girdilerden tek seferlik bir hesap, canlı türev değil).
 */
function scoreLead({ type, budgetRange, timeframe, email }) {
  let score = 0;
  if (HIGH_BUDGET_RANGES.has(budgetRange)) score += 3;
  if (NEAR_TERM_TIMEFRAMES.has(timeframe)) score += 2;
  if (isCorporateEmail(email)) score += 1;
  if (type === 'quote') score += 2;

  const temperature = score >= 6 ? 'hot' : score >= 3 ? 'warm' : 'cold';
  return { score, temperature };
}

module.exports = { scoreLead, isCorporateEmail };
