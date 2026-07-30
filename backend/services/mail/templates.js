const APP_NAME = 'Micro CRM';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Tek bir gövde iskeleti — tüm mailler aynı görünür.
 *
 * Neden inline stil: e-posta istemcileri (Gmail dahil) <style> bloklarını ve
 * harici CSS'i büyük ölçüde atıyor; tablo/inline stil dışında güvenilir bir
 * yol yok. Bu yüzden burada web tarafındaki CSS değişkenleri kullanılmıyor.
 */
function layout({ title, bodyHtml, ctaLabel, ctaUrl }) {
  const cta = ctaUrl
    ? `<p style="margin:24px 0 0"><a href="${esc(ctaUrl)}" style="display:inline-block;background:#2C43E0;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;font-size:14px">${esc(ctaLabel || 'Görüntüle')}</a></p>`
    : '';

  return `<!doctype html>
<html lang="tr"><body style="margin:0;padding:24px;background:#f4f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;border:1px solid #e6e9f0">
    <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.6px;color:#8a93a6;text-transform:uppercase">${esc(APP_NAME)}</p>
    <h1 style="margin:0 0 14px;font-size:19px;color:#141a24">${esc(title)}</h1>
    <div style="font-size:14px;line-height:1.6;color:#3c4457">${bodyHtml}</div>
    ${cta}
    <p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #eef1f5;font-size:11px;color:#98a1b2">
      Bu bildirimi ${esc(APP_NAME)} hesabınızın e-posta tercihleri açık olduğu için aldınız.
      Tercihlerinizi uygulamadaki Profil ekranından değiştirebilirsiniz.
    </p>
  </div>
</body></html>`;
}

// Düz metin alternatifi. Etiketler atıldıktan sonra HTML varlıkları GERİ
// ÇÖZÜLÜYOR — aksi halde metin sürümünde okuyucuya "&quot;" gibi kalıntılar
// görünüyor (gövde önce esc()'den geçtiği için).
const stripHtml = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

function build({ title, lines, ctaLabel, ctaUrl }) {
  const bodyHtml = lines.map((l) => `<p style="margin:0 0 10px">${l}</p>`).join('');
  const html = layout({ title, bodyHtml, ctaLabel, ctaUrl });
  return { html, text: stripHtml(bodyHtml) };
}

const appUrl = (path) => {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}${path || ''}`;
};

const templates = {
  TASK_ASSIGNED: ({ task, assignedByName }) => ({
    subject: `Yeni görev: ${task.title}`,
    ...build({
      title: 'Size yeni bir görev atandı',
      lines: [
        `<strong>${esc(assignedByName || 'Bir yönetici')}</strong> size <strong>${esc(task.title)}</strong> görevini atadı.`,
        task.deadline
          ? `Teslim tarihi: <strong>${new Date(task.deadline).toLocaleDateString('tr-TR')}</strong>`
          : 'Teslim tarihi belirtilmemiş.',
      ],
      ctaLabel: 'Görevi aç',
      ctaUrl: appUrl(`/tasks?id=${task._id}`),
    }),
  }),

  TASK_STATUS_CHANGED: ({ task, message }) => ({
    subject: `Görev durumu değişti: ${task.title}`,
    ...build({
      title: 'Görev durumu güncellendi',
      lines: [esc(message)],
      ctaLabel: 'Görevi aç',
      ctaUrl: appUrl(`/tasks?id=${task._id}`),
    }),
  }),

  TASK_COMMENT: ({ task, message }) => ({
    subject: `Yeni yorum: ${task.title}`,
    ...build({
      title: 'Göreve yorum yazıldı',
      lines: [esc(message)],
      ctaLabel: 'Görevi aç',
      ctaUrl: appUrl(`/tasks?id=${task._id}`),
    }),
  }),

  APPROVAL_DECIDED: ({ title, message }) => ({
    subject: title,
    ...build({
      title,
      lines: [esc(message)],
      ctaLabel: 'Onay kuyruğunu aç',
      ctaUrl: appUrl('/approvals'),
    }),
  }),
};

module.exports = { templates, appUrl };
