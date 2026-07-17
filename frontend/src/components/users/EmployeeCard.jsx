import { HiOutlinePhone, HiOutlineClock } from 'react-icons/hi';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { useLanguage } from '../../context/LanguageContext';
import { ROLE_LABELS, DEPARTMENT_LABELS } from '../../config/permissions';
import { monthsBetween, daysBetween, formatTenureSpan } from '../../utils/tenure';
import EmployeeAvatar from './EmployeeAvatar';

const IconLinks = ({ user }) => {
  const { phone, linkedin, github } = user.personalInfo || {};
  const { t } = useLanguage();
  if (!phone && !linkedin && !github) {
    return <span className="dept">{t('users.directory.noContact')}</span>;
  }
  const stop = (e) => e.stopPropagation();
  return (
    <>
      {phone && (
        <a className="icon-link" href={`tel:${phone}`} onClick={stop} aria-label={`${user.name} — telefon`}>
          <HiOutlinePhone />
        </a>
      )}
      {linkedin && (
        <a className="icon-link" href={linkedin} target="_blank" rel="noopener noreferrer" onClick={stop} aria-label={`${user.name} — LinkedIn`}>
          <FaLinkedin />
        </a>
      )}
      {github && (
        <a className="icon-link" href={github} target="_blank" rel="noopener noreferrer" onClick={stop} aria-label={`${user.name} — GitHub`}>
          <FaGithub />
        </a>
      )}
    </>
  );
};

const EmployeeCard = ({ user, onClick }) => {
  const { t } = useLanguage();
  const joinDate = user.hireDate || user.createdAt;
  const span = formatTenureSpan(monthsBetween(joinDate), daysBetween(joinDate));

  return (
    <article
      className="emp-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      aria-label={`${user.name} — detayları aç`}
    >
      <div className="emp-top">
        <EmployeeAvatar user={user} />
        <div className="emp-id">
          <h3 className="emp-name">{user.name}</h3>
          <div className="emp-meta">
            {user.status === 'pending' ? (
              <span className="pill pill--warning">{t('users.statuses.pending')}</span>
            ) : (
              <span className={`pill pill--${roleClass(user.role)}`}>{t(ROLE_LABELS[user.role])}</span>
            )}
            <span className="dept">{user.department ? t(DEPARTMENT_LABELS[user.department]) : t('departments.none')}</span>
            {user.isDepartmentLead && user.status !== 'pending' && (
              <span className="pill pill--accent">{t('users.directory.leadBadge')}</span>
            )}
          </div>
        </div>
      </div>
      <p className="tenure-line">
        <HiOutlineClock />
        <span>{span}</span>
        <span className="dot-sep">·</span>
        <span>{t('users.directory.tenureSuffix')}</span>
      </p>
      <div className="icon-row">
        <IconLinks user={user} />
      </div>
    </article>
  );
};

function roleClass(role) {
  if (role === 'super_admin') return 'danger';
  if (role === 'accountant') return 'info';
  if (role === 'support') return 'success';
  return 'accent'; // staff
}

export default EmployeeCard;
