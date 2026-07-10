import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ROLE_LABELS } from '../../config/permissions';
import { HiOutlineLogout } from 'react-icons/hi';

const Navbar = () => {
  const { user, customerUser, isInternal, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();

  // Staff show their own name; customers show their company/contact name so
  // the avatar still means something without a `name` field on CustomerUser.
  const displayName = isInternal ? user?.name : customerUser?.customer?.name || customerUser?.email;

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
        {/* Explicit, always-visible role indicator — the active user's
            permission level should never be a mystery. */}
        {user?.role && (
          <span className={`role-badge role-badge-${user.role}`}>
            {t(ROLE_LABELS[user.role])}
          </span>
        )}
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
        {(user || customerUser) && (
          <>
            <div className="user-avatar">{getInitials(displayName)}</div>
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
