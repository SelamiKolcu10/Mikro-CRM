import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { t, lang, toggleLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
      }
      toast.success(isLogin ? t('auth.loginSuccess') : t('auth.registerSuccess'));
      navigate('/');
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

        <p className="login-subtitle">
          {isLogin ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">{t('auth.name')}</label>
              <input
                type="text"
                name="name"
                className="form-input"
                value={form.name}
                onChange={handleChange}
                placeholder={t('auth.name')}
                required={!isLogin}
              />
            </div>
          )}

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
            {loading ? t('common.loading') : isLogin ? t('auth.login') : t('auth.register')}
          </button>
        </form>

        <p className="login-footer">
          {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); }}>
            {isLogin ? t('auth.register') : t('auth.login')}
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;
