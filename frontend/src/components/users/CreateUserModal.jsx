import { useState } from 'react';
import Modal from '../common/Modal';
import { useLanguage } from '../../context/LanguageContext';
import { ALL_ROLES, ROLE_LABELS } from '../../config/permissions';
import userService from '../../services/userService';
import toast from 'react-hot-toast';

const initialForm = { name: '', email: '', role: 'staff' };

/** Eski Kullanıcı Yönetimi tablosundaki "Yeni Kullanıcı Ekle" akışının birebir aynısı — ayrı bileşene taşındı. */
const CreateUserModal = ({ isOpen, onClose, onCreated }) => {
  const { t } = useLanguage();
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  const handleClose = () => {
    setForm(initialForm);
    setResult(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await userService.create(form);
      setResult(res.data.data);
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setCreating(false);
    }
  };

  if (result) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={<>🔑 {t('users.userCreated')}</>}
        footer={<button className="btn btn-primary" onClick={handleClose}>{t('common.close')}</button>}
      >
        <div>
          <p>{result.name} ({t(ROLE_LABELS[result.role])}) {t('users.userCreatedHint')}</p>
          <div className="form-group">
            <label className="form-label">{t('auth.email')}</label>
            <input type="text" className="form-input" value={result.email} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">{t('customers.temporaryPassword')}</label>
            <input type="text" className="form-input" value={result.temporaryPassword} readOnly />
          </div>
          <span className="form-hint">⚠️ {t('customers.portalAccessWarning')}</span>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={<>👤 {t('users.createUser')}</>}
      footer={
        <>
          <button className="btn btn-secondary" onClick={handleClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={creating}>
            {creating ? t('common.loading') : t('common.create')}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">{t('auth.name')} *</label>
          <input
            type="text"
            className="form-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('auth.email')} *</label>
          <input
            type="email"
            className="form-input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('users.role')} *</label>
          <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ALL_ROLES.filter((r) => r !== 'super_admin').map((role) => (
              <option key={role} value={role}>{t(ROLE_LABELS[role])}</option>
            ))}
          </select>
        </div>
        <span className="form-hint">💡 {t('users.createUserHint')}</span>
      </form>
    </Modal>
  );
};

export default CreateUserModal;
