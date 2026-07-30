const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIO, userRoom } = require('../socket');
const mailService = require('./mailService');

/**
 * Bildirim üretimi — tek giriş noktası.
 *
 * İki kanal birlikte çalışır:
 *  1. MongoDB kaydı — kalıcı. Kullanıcı çevrimdışıysa tek kanal budur.
 *  2. `user:<id>` odasına socket yayını — o an bağlıysa anında görür.
 *
 * TASARIM KURALI: bildirim asla ana işlemi bozmaz. Görev oluşturma, yorum
 * yazma gibi akışların içinden çağrıldığı için buradaki hiçbir hata yukarı
 * fırlatılmaz — bildirim gitmezse iş yine tamamlanır. Sessiz yutma değil,
 * konsola yazılır (slaEscalationService ve quoteNotify aynı yaklaşımı izliyor).
 */

/** Kişinin kendi eylemi kendisine bildirilmez. */
const isSelf = (recipientId, actorId) =>
  !!actorId && String(recipientId) === String(actorId);

/**
 * Üçüncü kanal: e-posta. Sistem içi bildirimden SONRA ve ondan bağımsız
 * çalışır — mail atlanırsa/patlarsa bildirim yine düşmüş olur.
 *
 * `emailData` şablonun beklediği veriyi taşır; verilmezse mail denenmez
 * (bazı bildirim türlerinin e-posta karşılığı olmayabilir).
 */
async function sendEmailFor(recipientId, type, emailData) {
  if (!emailData) return;
  try {
    const user = await User.findById(recipientId).select('email emailPreferences');
    if (user) await mailService.sendNotificationEmail(user, type, emailData);
  } catch (err) {
    console.error('Notification email step failed:', err.message);
  }
}

async function notify({ recipient, type, title, message, link = null, meta = null, actor = null, emailData = null }) {
  try {
    if (!recipient) return null;
    if (isSelf(recipient, actor)) return null;

    const doc = await Notification.create({ recipient, type, title, message, link, meta, actor });

    // Yayın DB kaydından SONRA: istemci olayı alıp listeyi tazelediğinde kayıt
    // zaten orada olsun, yoksa yeni bildirim listede görünmez.
    try {
      const payload = {
        _id: doc._id,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        link: doc.link,
        meta: doc.meta,
        isRead: doc.isRead,
        createdAt: doc.createdAt,
      };
      getIO().to(userRoom(recipient)).emit('notification:new', payload);
    } catch (err) {
      // Socket başlatılmamış olabilir (ör. testler, betikler) — kayıt yine durur.
      console.error('Notification socket emit failed:', err.message);
    }

    await sendEmailFor(recipient, type, emailData);

    return doc;
  } catch (err) {
    console.error('Notification create failed:', err.message);
    return null;
  }
}

/**
 * Görev atandı — `taskController.createTask` içinden çağrılır.
 *
 * `assignedTo` yalnız görev oluşturulurken yazılıyor, yeniden atama ucu yok;
 * bu yüzden tek tetikleme noktası burasıdır.
 */
function taskAssigned({ task, assignedByUser }) {
  return notify({
    recipient: task.assignedTo?._id || task.assignedTo,
    actor: assignedByUser?._id,
    type: 'TASK_ASSIGNED',
    title: 'Yeni görev atandı',
    message: `${assignedByUser?.name || 'Bir yönetici'} size "${task.title}" görevini atadı.`,
    link: `/tasks?id=${task._id}`,
    meta: { taskId: task._id, department: task.department, priority: task.priority },
    emailData: { task, assignedByName: assignedByUser?.name },
  });
}

const STATUS_LABEL = {
  todo: 'Yapılacak',
  in_progress: 'Yapılıyor',
  in_review: 'İncelemede',
  done: 'Tamamlandı',
};

/**
 * Görev durumu değişti — görevi ATAYAN kişiye haber verilir.
 * (Durumu değiştiren genelde atanan kişinin kendisi; ona bildirim gitmesi
 * anlamsız olurdu. `notify` içindeki isSelf kontrolü, atayan kişi durumu
 * kendisi değiştirdiğinde de gereksiz bildirimi engelliyor.)
 */
function taskStatusChanged({ task, fromStatus, toStatus, changedByUser }) {
  const message = `${changedByUser?.name || 'Bir kullanıcı'} "${task.title}" görevini ${
    STATUS_LABEL[fromStatus] || fromStatus
  } → ${STATUS_LABEL[toStatus] || toStatus} olarak güncelledi.`;

  return notify({
    recipient: task.assignedBy?._id || task.assignedBy,
    actor: changedByUser?._id,
    type: 'TASK_STATUS_CHANGED',
    title: 'Görev durumu değişti',
    message,
    link: `/tasks?id=${task._id}`,
    meta: { taskId: task._id, fromStatus, toStatus },
    emailData: { task, message },
  });
}

/**
 * Göreve yorum yazıldı — görevin ATANAN kişisine ve ATAYANINA haber verilir
 * (yorumu yazan hariç, isSelf eliyor). İki ayrı bildirim üretir; aynı kişi
 * hem atanan hem atayan olabileceği için tekilleştiriliyor.
 */
function taskCommented({ task, comment, authorUser }) {
  const targets = [...new Set(
    [task.assignedTo?._id || task.assignedTo, task.assignedBy?._id || task.assignedBy]
      .filter(Boolean)
      .map(String)
  )];

  const preview = String(comment?.text || '').slice(0, 120);
  const message = `${authorUser?.name || 'Bir kullanıcı'} "${task.title}" görevine yorum yazdı: ${preview}`;

  return Promise.all(
    targets.map((recipient) =>
      notify({
        recipient,
        actor: authorUser?._id,
        type: 'TASK_COMMENT',
        title: 'Göreve yeni yorum',
        message,
        link: `/tasks?id=${task._id}`,
        meta: { taskId: task._id },
        emailData: { task, message },
      })
    )
  );
}

/**
 * Onay talebi sonuçlandı — talebi AÇAN kişiye haber verilir.
 * `conflict` de bir sonuçtur ve kullanıcıyı ilgilendirir: talebi onaylandı
 * sanmasın, yeniden oluşturması gerektiğini bilsin.
 */
function approvalDecided({ approval, decidedByUser }) {
  const outcome = {
    approved: { title: 'Talebiniz onaylandı', verb: 'onayladı' },
    rejected: { title: 'Talebiniz reddedildi', verb: 'reddetti' },
    conflict: { title: 'Talebiniz uygulanamadı', verb: 'inceledi' },
  }[approval.status] || { title: 'Talebiniz sonuçlandı', verb: 'inceledi' };

  const extra =
    approval.status === 'conflict'
      ? ' Kayıt talepten sonra değiştiği için işlem uygulanmadı, talebi yeniden oluşturmanız gerekiyor.'
      : approval.rejectionReason
        ? ` Gerekçe: ${approval.rejectionReason}`
        : '';

  const message = `${decidedByUser?.name || 'Bir yönetici'} ${approval.resource}/${approval.action} talebinizi ${outcome.verb}.${extra}`;

  return notify({
    recipient: approval.requestedBy,
    actor: decidedByUser?._id,
    type: 'APPROVAL_DECIDED',
    title: outcome.title,
    message,
    link: '/approvals',
    meta: { approvalId: approval._id, status: approval.status, resource: approval.resource },
    emailData: { title: outcome.title, message },
  });
}

const QUOTE_EVENT_TEXT = {
  'quote:viewed': { title: 'Teklif görüntülendi', verb: 'teklifinizi görüntüledi' },
  'quote:accepted': { title: 'Teklif kabul edildi', verb: 'teklifinizi KABUL ETTİ' },
  'quote:rejected': { title: 'Teklif reddedildi', verb: 'teklifinizi reddetti' },
};

/**
 * Müşteri public bağlantıdan teklife bir şey yaptı — teklifin SAHİBİNE
 * (quote.owner) haber verilir.
 *
 * Neden burada: bu olaylar eskiden yalnız STAFF_ROOM'a yayınlanıyordu
 * (utils/quoteNotify.js). O oda sohbet kapsamlı olduğu için muhasebeci —
 * teklif/faturanın asıl sahibi olan rol — hiçbir şey alamıyordu. Üstelik ne
 * webde ne mobilde o olayları dinleyen bir kod vardı, yani yayın boşa
 * gidiyordu. Kişiye özel bildirim kanalı bu iki sorunu birden çözüyor.
 *
 * Actor yok: eylemi yapan bir personel değil, müşterinin kendisi.
 */
function quoteEvent({ event, quote }) {
  const text = QUOTE_EVENT_TEXT[event];
  if (!text || !quote?.owner) return null;

  const customerName = quote.customer?.name || quote.customer?.company || 'Müşteri';
  const message = `${customerName}, ${quote.quoteNumber} numaralı ${text.verb}.`;

  return notify({
    recipient: quote.owner?._id || quote.owner,
    actor: null,
    type: 'QUOTE_EVENT',
    title: text.title,
    message,
    link: `/quotes?id=${quote._id}`,
    meta: { quoteId: quote._id, quoteNumber: quote.quoteNumber, event },
    // E-posta şablonu yok: müşteri her görüntülemede mail atmak gürültü olur.
    // Kabul/red için şablon eklenmek istenirse templates.js'e QUOTE_EVENT
    // eklenip buraya emailData verilmesi yeterli.
    emailData: null,
  });
}

module.exports = {
  notify,
  taskAssigned,
  taskStatusChanged,
  taskCommented,
  approvalDecided,
  quoteEvent,
};
