import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineMail, HiOutlineRefresh } from 'react-icons/hi';
import { useLanguage } from '../context/LanguageContext';
import Modal from '../components/common/Modal';
import mailLogService from '../services/mailLogService';

const STATUS_BADGE = {
  mocked: 'badge-open',
  sent: 'badge-resolved',
  failed: 'badge-bug',
  skipped: 'badge-high',
};

const STATUS_LABEL = {
  mocked: 'Taslak (gönderilmedi)',
  sent: 'Gönderildi',
  failed: 'Hata',
  skipped: 'Atlandı',
};

const FILTERS = ['', 'mocked', 'sent', 'failed', 'skipped'];

/**
 * Mail Gönderimleri — sistemin ürettiği her e-postanın kaydı.
 *
 * Bu ekranın asıl işi, mail GERÇEKTEN gönderilmeye başlanmadan önce
 * "kime ne gidecekti" sorusunu cevaplamak. Bu yüzden en üstte hattın o anki
 * modu açıkça yazılıyor: mock modda kayıtlar "Taslak (gönderilmedi)" olarak
 * işaretlenir, kimse bunları gerçekten gitmiş sanmasın.
 */
const MailLogs = () => {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState(null);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mailLogService.getAll(status ? { status } : {});
      setItems(res.data.data || []);
      setConfig(res.data.config || null);
      setCounts(res.data.statusCounts || {});
    } catch {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => {
    load();
  }, [load]);

  const openPreview = async (id) => {
    try {
      const res = await mailLogService.getById(id);
      setPreview(res.data.data);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const modeLabel = !config
    ? '—'
    : !config.enabled
      ? 'E-posta kapalı — hiçbir mail denenmiyor'
      : config.provider === 'mock'
        ? 'Deneme modu — mailler üretiliyor ama GÖNDERİLMİYOR'
        : 'Canlı — mailler gerçekten gönderiliyor';

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Mail Gönderimleri</h1>
          <p>Sistemin ürettiği e-postaların kaydı ve içerikleri</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          <HiOutlineRefresh /> Yenile
        </button>
      </div>

      {/* Hattın o anki modu — ekranın en önemli bilgisi */}
      <div className={`maillog-mode ${config?.enabled && config?.provider !== 'mock' ? 'maillog-mode--live' : ''}`}>
        <HiOutlineMail />
        <div>
          <strong>{modeLabel}</strong>
          <span>
            Gerçek gönderime geçmek için <code>backend/.env</code> içinde{' '}
            <code>MAIL_PROVIDER=smtp</code> yapıp SMTP bilgilerini doldurmanız yeterli — kod
            değişikliği gerekmiyor.
          </span>
        </div>
      </div>

      <div className="maillog-filters">
        {FILTERS.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`chip ${status === s ? 'active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s ? STATUS_LABEL[s] : 'Tümü'}
            {s && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Alıcı</th>
                <th>Konu</th>
                <th>Tür</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="table-empty"><p>Kayıt yok.</p></div>
                  </td>
                </tr>
              ) : (
                items.map((m) => (
                  <tr key={m._id} onClick={() => openPreview(m._id)} style={{ cursor: 'pointer' }}>
                    <td data-label="Alıcı">
                      <div className="cell-name">{m.recipientUser?.name || '—'}</div>
                      <div className="cell-email">{m.to}</div>
                    </td>
                    <td data-label="Konu">{m.subject}</td>
                    <td data-label="Tür">{m.kind || '—'}</td>
                    <td data-label="Durum">
                      <span className={`badge ${STATUS_BADGE[m.status] || ''}`}>
                        {STATUS_LABEL[m.status] || m.status}
                      </span>
                      {!!m.reason && <div className="cell-email">{m.reason}</div>}
                      {!!m.error && <div className="cell-email" style={{ color: 'var(--color-danger)' }}>{m.error}</div>}
                    </td>
                    <td data-label="Tarih">{new Date(m.createdAt).toLocaleString('tr-TR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Gövde önizlemesi. Kendi overlay'imi yazmıyorum: paylaşılan Modal
          içeriği document.body'ye portallıyor — `.page-container`'ın giriş
          animasyonu transform kullandığı için sayfa içinde render edilen
          position:fixed overlay'ler viewport yerine sayfa akışına göre
          konumlanıyor ve görünmez oluyor. */}
      <Modal
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.subject || ''}
      >
        <p className="cell-email" style={{ marginBottom: 10 }}>{preview?.to}</p>
        {/* Gövde sistemin kendi şablonundan üretiliyor, dışarıdan gelen içerik
            değil; yine de sandbox'lı iframe'de gösteriliyor ki sayfanın
            stilini/JS'ini etkilemesin. */}
        <iframe
          title="mail-preview"
          className="maillog-preview-frame"
          sandbox=""
          srcDoc={preview?.html || `<pre>${preview?.text || ''}</pre>`}
        />
      </Modal>
    </>
  );
};

export default MailLogs;
