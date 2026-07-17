import { HiOutlineInformationCircle, HiOutlineShieldExclamation, HiOutlineExclamationCircle, HiOutlineSearch } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

const COLLECTIONS = ['User', 'Customer', 'CustomerUser', 'Feedback', 'PermissionOverride', 'System'];
const ACTIONS = ['create', 'update', 'delete'];
const SEVERITIES = [
  { value: 'info', icon: HiOutlineInformationCircle },
  { value: 'sensitive', icon: HiOutlineShieldExclamation },
  { value: 'critical', icon: HiOutlineExclamationCircle },
];

const AuditFilterBar = ({
  collectionName, setCollectionName,
  action, setAction,
  severity, setSeverity,
  severityCounts,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  search, setSearch,
  actors, actorEmail, setActorEmail,
  onClear,
}) => {
  const { t } = useLanguage();

  const totalCount = severityCounts ? Object.values(severityCounts).reduce((a, b) => a + b, 0) : 0;
  const hasActiveFilters = collectionName || action || severity || dateFrom || dateTo || search || actorEmail;

  return (
    <div className="audit-filter-bar">
      <div className="audit-filter-bar-row">
        <button
          type="button"
          className={`filter-chip severity-chip ${!severity ? 'active' : ''}`}
          onClick={() => setSeverity('')}
        >
          {t('auditLog.allSeverities')} ({totalCount})
        </button>
        {SEVERITIES.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            data-severity={value}
            className={`filter-chip severity-chip ${severity === value ? 'active' : ''}`}
            onClick={() => setSeverity(severity === value ? '' : value)}
          >
            <Icon style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {t(`auditLog.severity${value[0].toUpperCase()}${value.slice(1)}`)} ({severityCounts?.[value] ?? 0})
          </button>
        ))}
      </div>

      <div className="audit-filter-bar-row">
        <div className="search-bar">
          <HiOutlineSearch className="search-icon" />
          <input
            type="text"
            placeholder={t('auditLog.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select className="form-input" value={collectionName} onChange={(e) => setCollectionName(e.target.value)}>
          <option value="">{t('auditLog.allCollections')}</option>
          {COLLECTIONS.map((c) => <option key={c} value={c}>{t(`auditLog.collections.${c[0].toLowerCase()}${c.slice(1)}`)}</option>)}
        </select>

        <select className="form-input" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">{t('auditLog.allActions')}</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{t(`auditLog.action${a[0].toUpperCase()}${a.slice(1)}`)}</option>)}
        </select>

        {actors && (
          <select className="form-input" value={actorEmail} onChange={(e) => setActorEmail(e.target.value)}>
            <option value="">{t('auditLog.allActors')}</option>
            {actors.map((email) => <option key={email} value={email}>{email}</option>)}
          </select>
        )}

        <input
          type="date"
          className="form-input"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title={t('auditLog.dateFrom')}
        />
        <input
          type="date"
          className="form-input"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title={t('auditLog.dateTo')}
        />

        {hasActiveFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
            {t('auditLog.clearFilters')}
          </button>
        )}
      </div>
    </div>
  );
};

export default AuditFilterBar;
