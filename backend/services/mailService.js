const MailLog = require('../models/MailLog');
const { getMailProvider } = require('./mail');
const { templates } = require('./mail/templates');

/**
 * E-posta gönderimi — tek giriş noktası.
 *
 * ÜÇ KAPI var, sırayla:
 *  1. `EMAIL_NOTIFICATIONS_ENABLED` bayrağı — kapalıysa hiç denenmez.
 *  2. Kullanıcının `emailPreferences` tercihi — o tür için kapalıysa atlanır.
 *  3. Sağlayıcı — `MAIL_PROVIDER=mock` (varsayılan) ise gerçekten gönderilmez.
 *
 * HER durumda MailLog'a bir satır yazılır (mocked/skipped/sent/failed) —
 * "Mail Gönderimleri" ekranı bu kaydı gösterir. Amaç: sistem canlıya
 * alınmadan önce kime ne gideceğinin görülebilmesi.
 *
 * TASARIM KURALI: mail asla ana işlemi bozmaz. notificationService'ten
 * çağrıldığı için buradaki hiçbir hata yukarı fırlatılmaz.
 */

const isEnabled = () => process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';

/** Kullanıcı bu tür için mail istiyor mu? Tercih yoksa varsayılan: istiyor. */
function wantsEmail(user, kind) {
  const prefs = user?.emailPreferences;
  if (!prefs) return true;
  const key = {
    TASK_ASSIGNED: 'taskAssigned',
    TASK_STATUS_CHANGED: 'taskStatusChanged',
    TASK_COMMENT: 'taskComment',
    APPROVAL_DECIDED: 'approvalDecided',
  }[kind];
  if (!key) return true;
  return prefs[key] !== false;
}

async function record(entry) {
  try {
    return await MailLog.create(entry);
  } catch (err) {
    console.error('MailLog write failed:', err.message);
    return null;
  }
}

/**
 * Bildirim türüne göre şablonu seçip gönderir.
 *
 * @param {object} user  alıcı (email + emailPreferences taşımalı)
 * @param {string} kind  Notification.type ile aynı sözlük
 * @param {object} data  şablonun beklediği veriler
 */
async function sendNotificationEmail(user, kind, data) {
  try {
    if (!user?.email) return null;

    const provider = getMailProvider();
    const base = { to: user.email, kind, recipientUser: user._id, provider: provider.name };

    if (!isEnabled()) {
      return record({
        ...base,
        subject: `[gönderilmedi] ${kind}`,
        status: 'skipped',
        reason: 'EMAIL_NOTIFICATIONS_ENABLED kapalı',
      });
    }

    if (!wantsEmail(user, kind)) {
      return record({
        ...base,
        subject: `[gönderilmedi] ${kind}`,
        status: 'skipped',
        reason: 'Kullanıcı bu tür için e-posta istemiyor',
      });
    }

    const template = templates[kind];
    if (!template) {
      return record({
        ...base,
        subject: `[şablon yok] ${kind}`,
        status: 'skipped',
        reason: `'${kind}' için e-posta şablonu tanımlı değil`,
      });
    }

    const { subject, html, text } = template(data);

    try {
      const result = await provider.send({ to: user.email, subject, html, text });
      return record({
        ...base,
        subject,
        html,
        text,
        // Mock sağlayıcı `delivered: false` döner — kayıt 'sent' değil
        // 'mocked' olur, böylece gerçekten gitmiş maillerle karışmaz.
        status: result.delivered ? 'sent' : 'mocked',
        messageId: result.messageId || null,
        reason: result.delivered ? null : 'Mock sağlayıcı — gerçekten gönderilmedi',
      });
    } catch (err) {
      return record({ ...base, subject, html, text, status: 'failed', error: err.message });
    }
  } catch (err) {
    console.error('sendNotificationEmail failed:', err.message);
    return null;
  }
}

module.exports = { sendNotificationEmail, isEnabled };
