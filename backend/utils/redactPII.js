// intern'e gösterilmeden maskelenecek PII alan adları. Telefon da dahil
// (Lead.phone + User.personalInfo.phone gibi) — email tek başına yeterli
// değil, tutarlı bir PII maskesi için (bkz. leads salt-okunur intern erişimi).
const PII_KEYS = new Set(['email', 'actorEmail', 'phone']);

/**
 * Cevap gövdesini (iç içe/populate edilmiş nesneler dahil) derinlemesine
 * gezip her `email`/`actorEmail`/`phone` alanının değerini '******' ile
 * değiştirir. Mongoose belgelerini JSON round-trip ile düz nesneye çevirip
 * öyle gezer — doğrudan Mongoose doküman iç yapısına (getter'lar, _doc vb.)
 * takılmamak için. Sadece intern rolü için çağrılır (bkz. middleware/
 * redactForIntern.js).
 */
function redactPII(data) {
  if (data === undefined || data === null) return data;

  const plain = JSON.parse(JSON.stringify(data));

  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        if (PII_KEYS.has(key) && typeof node[key] === 'string') {
          node[key] = '******';
        } else {
          walk(node[key]);
        }
      }
    }
  };

  walk(plain);
  return plain;
}

module.exports = { redactPII };
