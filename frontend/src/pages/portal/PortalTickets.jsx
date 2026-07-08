import { useState, useEffect, useCallback } from 'react';
import portalTicketService from '../../services/portalTicketService';
import Modal from '../../components/common/Modal';
import toast from 'react-hot-toast';
import { HiOutlinePlus } from 'react-icons/hi';

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

const initialForm = { title: '', description: '', type: 'bug' };

const PortalTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await portalTicketService.getAll();
      setTickets(res.data.data);
    } catch (err) {
      toast.error('Talepler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await portalTicketService.create(form);
      toast.success('Talebiniz oluşturuldu ✅');
      setModalOpen(false);
      setForm(initialForm);
      fetchTickets();
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
          <h1>🎫 Taleplerim</h1>
          <p>Destek taleplerinizi buradan takip edebilir, yenisini oluşturabilirsiniz</p>
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
              ) : tickets.length === 0 ? (
                <tr><td colSpan={4}>Henüz talebiniz yok</td></tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket._id}>
                    <td>{ticket.title}</td>
                    <td>{TYPE_LABELS[ticket.type] || ticket.type}</td>
                    <td>
                      <span className="status-badge" style={{ color: STATUS_COLORS[ticket.status] }}>
                        ● {STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                    </td>
                    <td>{new Date(ticket.createdAt).toLocaleDateString('tr-TR')}</td>
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
