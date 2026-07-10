import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ROLES } from '../../config/permissions';
import { HiOutlineEye } from 'react-icons/hi';

/**
 * Backend enforcement for Intern's read-only access already exists (see
 * config/permissions.js — Intern has no `write` entries anywhere). This is
 * purely the visible reinforcement: a persistent reminder rather than
 * discovering the restriction only when a button turns out to do nothing.
 */
const ReadOnlyBanner = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (user?.role !== ROLES.INTERN) return null;

  return (
    <div className="readonly-banner">
      <HiOutlineEye />
      <strong>{t('common.readOnlyMode')}</strong>
      <span>{t('common.readOnlyModeHint')}</span>
    </div>
  );
};

export default ReadOnlyBanner;
