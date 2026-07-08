import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DEFAULT_ROUTE_BY_ROLE } from '../config/permissions';
import toast from 'react-hot-toast';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(form.email, form.password);
      toast.success(t('auth.loginSuccess'));
      navigate(res.data.accountType === 'customer' ? '/portal' : (DEFAULT_ROUTE_BY_ROLE[res.data.role] || '/'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Language toggle in corner */}
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <div className="lang-toggle">
            <button
              className={`lang-btn ${lang === 'tr' ? 'active' : ''}`}
              onClick={() => lang !== 'tr' && toggleLanguage()}
            >
              TR
            </button>
            <button
              className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => lang !== 'en' && toggleLanguage()}
            >
              EN
            </button>
          </div>
        </div>

        <div className="login-logo">
          <div className="logo-icon">μ</div>
          <h1>Micro CRM</h1>
        </div>

        <p className="login-subtitle">{t('auth.loginSubtitle')}</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.email')}</label>
            <input
              type="email"
              name="email"
              className="form-input"
              value={form.email}
              onChange={handleChange}
              placeholder="admin@microcrm.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <input
              type="password"
              name="password"
              className="form-input"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>

        <p className="login-footer">{t('auth.noAccountHint')}</p>
      </div>
    </div>
  );
};

export default Login;
