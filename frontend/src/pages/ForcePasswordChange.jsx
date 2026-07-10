import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DEFAULT_ROUTE_BY_ROLE } from '../config/permissions';
import authService from '../services/authService';
import toast from 'react-hot-toast';

const ForcePasswordChange = () => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [loading, setLoading] = useState(false);
  const { session, updateToken, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmNewPassword) {
      toast.error(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      const res = await authService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      updateToken(res.data.data.token);
      toast.success(t('auth.passwordChanged'));
      navigate(DEFAULT_ROUTE_BY_ROLE[session?.role] || '/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">μ</div>
          <h1>Micro CRM</h1>
        </div>

        <h2 style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>{t('auth.forceChangeTitle')}</h2>
        <p className="login-subtitle">{t('auth.forceChangeSubtitle')}</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.currentPassword')}</label>
            <input
              type="password"
              name="currentPassword"
              className="form-input"
              value={form.currentPassword}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.newPassword')}</label>
            <input
              type="password"
              name="newPassword"
              className="form-input"
              value={form.newPassword}
              onChange={handleChange}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.confirmNewPassword')}</label>
            <input
              type="password"
              name="confirmNewPassword"
              className="form-input"
              value={form.confirmNewPassword}
              onChange={handleChange}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('common.loading') : t('auth.updatePassword')}
          </button>
        </form>

        <p className="login-footer">
          <button type="button" className="btn-link" onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            {t('auth.logout')}
          </button>
        </p>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
