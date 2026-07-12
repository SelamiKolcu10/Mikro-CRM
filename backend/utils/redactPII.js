const EMAIL_KEYS = new Set(['email', 'actorEmail']);

/**
 * Cevap gövdesini (iç içe/populate edilmiş nesneler dahil) derinlemesine
 * gezip her `email`/`actorEmail` alanının değerini '******' ile değiştirir.
 * Mongoose belgelerini JSON round-trip ile düz nesneye çevirip öyle gezer —
 * doğrudan Mongoose doküman iç yapısına (getter'lar, _doc vb.) takılmamak
 * için. Sadece intern rolü için çağrılır (bkz. middleware/redactForIntern.js).
 */
function redactEmails(data) {
  if (data === undefined || data === null) return data;

  const plain = JSON.parse(JSON.stringify(data));

  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        if (EMAIL_KEYS.has(key) && typeof node[key] === 'string') {
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

module.exports = { redactEmails };
