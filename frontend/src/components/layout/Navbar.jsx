import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { HiOutlineLogout } from 'react-icons/hi';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        {/* Can be used for breadcrumbs or page title later */}
      </div>

      <div className="navbar-right">
        {/* Language Toggle */}
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

        {/* User Info */}
        {user && (
          <>
            <div className="user-avatar">{getInitials(user.name)}</div>
            <button
              className="btn-icon"
              onClick={logout}
              title={t('auth.logout')}
            >
              <HiOutlineLogout />
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
