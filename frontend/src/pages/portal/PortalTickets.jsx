import { useState, useEffect, useCallback } from 'react';
import portalTicketService from '../../services/portalTicketService';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { HiOutlinePlus } from 'react-icons/hi';

// Destek talebi (Feedback) etiketleri
const STATUS_LABELS = {
  open: 'Açık',
  'in-progress': 'İşlemde',
  resolved: 'Çözüldü',
  closed: 'Kapatıldı',
};

const STATUS_COLORS = {
  open: 'var(--color-info)',
  'in-progress': 'var(--color-warning)',
  resolved: 'var(--color-success)',
  closed: 'var(--text-tertiary)',
};

const TYPE_LABELS = { bug: 'Hata', feature: 'Özellik İsteği', improvement: 'İyileştirme' };

// Başvuru (Lead) etiketleri — portal TR-only olduğundan sabit Türkçe.
const LEAD_TYPE_LABELS = { quote: 'Fiyat teklifi', idea: 'Proje fikri', question: 'Genel soru' };
const LEAD_STATUS_LABELS = {
  new: 'Yeni',
  in_review: 'İncelemede',
  contacted: 'İletişime Geçildi',
  quoted: 'Teklif Verildi',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
};
const LEAD_STATUS_COLORS = {
  new: 'var(--color-info)',
  in_review: 'var(--color-warning)',
  contacted: 'var(--accent-secondary)',
  quoted: 'var(--plan-premium)',
  won: 'var(--color-success)',
  lost: 'var(--text-tertiary)',
};

const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n).trimEnd()}…` : s || '');

const initialForm = { title: '', description: '', type: 'bug' };

const PortalTickets = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  // Destek talepleri (Feedback) + başvurular (Lead) tek listede — kullanıcı
  // "Taleplerim"de ikisini birlikte görür (bkz. istek). İki farklı veri modeli
  // ortak bir satır şekline normalize edilip tarihe göre birleştirilir.
  const fetchAll = useCallback(async () => {
    try {
      const [fbRes, leadRes] = await Promise.all([
        portalTicketService.getAll(),
        portalTicketService.getMyLeads(),
      ]);
      const fbItems = fbRes.data.data.map((f) => ({
        id: f._id,
        kind: 'ticket',
        category: 'Destek',
        title: f.title,
        typeLabel: TYPE_LABELS[f.type] || f.type,
        statusLabel: STATUS_LABELS[f.status] || f.status,
        statusColor: STATUS_COLORS[f.status],
        createdAt: f.createdAt,
      }));
      const leadItems = leadRes.data.data.map((l) => ({
        id: l._id,
        kind: 'lead',
        category: 'Başvuru',
        title: truncate(l.message, 60) || LEAD_TYPE_LABELS[l.type],
        typeLabel: LEAD_TYPE_LABELS[l.type] || l.type,
        statusLabel: LEAD_STATUS_LABELS[l.status] || l.status,
        statusColor: LEAD_STATUS_COLORS[l.status],
        createdAt: l.createdAt,
      }));
      setItems([...fbItems, ...leadItems].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
      toast.error('Talepler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await portalTicketService.create(form);
      toast.success('Talebiniz oluşturuldu');
      setModalOpen(false);
      setForm(initialForm);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Taleplerim</h1>
          <p>Destek talepleriniz ve başvurularınızı buradan takip edebilirsiniz</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <HiOutlinePlus /> Yeni Talep
        </button>
      </div>

      <div className="table-container">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Tür</th>
                <th>Durum</th>
                <th>Oluşturulma</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4}>Yükleniyor...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4}>Henüz talebiniz yok</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={`${item.kind}-${item.id}`}>
                    <td data-label="Başlık">
                      <span className={`portal-kind-badge portal-kind-badge--${item.kind}`}>{item.category}</span>
                      {item.title}
                    </td>
                    <td data-label="Tür">{item.typeLabel}</td>
                    <td data-label="Durum">
                      <span className="status-badge" style={{ color: item.statusColor }}>
                        ● {item.statusLabel}
                      </span>
                    </td>
                    <td data-label="Oluşturulma">{new Date(item.createdAt).toLocaleDateString('tr-TR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Yeni Talep Oluştur"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              İptal
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </>
        }
      >
        <form className="form-group" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Başlık</label>
            <input
              type="text"
              className="form-input"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Kısaca sorununuzu özetleyin"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tür</label>
            <select
              className="form-select"
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="bug">Hata</option>
              <option value="feature">Özellik İsteği</option>
              <option value="improvement">İyileştirme</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Açıklama</label>
            <textarea
              className="form-input"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Yaşadığınız sorunu/isteği detaylandırın"
            />
          </div>
        </form>
      </Modal>
    </>
  );
};

export default PortalTickets;
