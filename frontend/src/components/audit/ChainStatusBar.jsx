import { HiOutlineShieldCheck, HiOutlineExclamationCircle, HiOutlineRefresh } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Sticky strip surfacing hash-chain integrity state. This is the one place
 * in the UI a broken chain is guaranteed unmissable, regardless of how far
 * down the timeline the actual break sits.
 */
const ChainStatusBar = ({ loading, error, result, onReverify, onJumpToBreak }) => {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="chain-status-bar chain-status-bar--verifying">
        <div className="chain-status-bar-text">
          <div className="spinner spinner-sm" />
          <span>{t('auditLog.chainVerifying')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chain-status-bar chain-status-bar--unavailable">
        <div className="chain-status-bar-text">
          <HiOutlineExclamationCircle />
          <span>{t('auditLog.chainUnavailable')}</span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onReverify}>{t('auditLog.retry')}</button>
      </div>
    );
  }

  if (!result) return null;

  if (!result.intact) {
    return (
      <div className="chain-status-bar chain-status-bar--broken">
        <div className="chain-status-bar-text">
          <HiOutlineExclamationCircle size={20} />
          <span className="chain-status-bar-heading">
            {t('auditLog.chainBroken')} — {t('auditLog.chainBrokenAt').replace('{sequence}', result.brokenAtSequence)}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onJumpToBreak}>
          {t('auditLog.jumpToBreak')} ↓
        </button>
      </div>
    );
  }

  return (
    <div className="chain-status-bar chain-status-bar--verified">
      <div className="chain-status-bar-text">
        <HiOutlineShieldCheck size={20} />
        <span>
          {t('auditLog.chainVerified')} · {t('auditLog.chainRecordCount').replace('{count}', result.totalChecked)}
          {result.checkedAt && ` · ${t('auditLog.chainLastCheck').replace('{time}', new Date(result.checkedAt).toLocaleTimeString('tr-TR'))}`}
        </span>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onReverify}>
        <HiOutlineRefresh /> {t('auditLog.reverify')}
      </button>
    </div>
  );
};

export default ChainStatusBar;
