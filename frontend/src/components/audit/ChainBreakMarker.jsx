import { forwardRef } from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

const shortHash = (hash) => (hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—');

/**
 * Rendered at the exact position the chain breaks: the spine above it turns
 * dashed, and this band names the expected vs. found hash so the break is
 * legible, not just flagged.
 */
const ChainBreakMarker = forwardRef(({ brokenAtSequence, expected, found, flash }, ref) => {
  const { t } = useLanguage();

  return (
    <div className={`timeline-entry-row ${flash ? 'timeline-flash' : ''}`} ref={ref}>
      <div className="timeline-gutter">
        <div className="timeline-spine timeline-spine--broken" />
      </div>
      <div className="chain-break-marker">
        <div className="chain-break-marker-heading">
          <HiOutlineExclamationCircle style={{ verticalAlign: 'middle' }} /> {t('auditLog.chainBreakHeading')}
        </div>
        <p className="chain-break-marker-body">{t('auditLog.chainBreakBody')}</p>
        <div className="chain-break-marker-hashes">
          {t('auditLog.chainBrokenAt').replace('{sequence}', brokenAtSequence)}
          <br />
          {t('auditLog.chainBreakExpected').replace('{expected}', shortHash(expected))}
          {' · '}
          {t('auditLog.chainBreakFound').replace('{found}', shortHash(found))}
        </div>
      </div>
    </div>
  );
});

ChainBreakMarker.displayName = 'ChainBreakMarker';

export default ChainBreakMarker;
