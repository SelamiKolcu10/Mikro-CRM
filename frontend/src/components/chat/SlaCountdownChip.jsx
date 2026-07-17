import { HiOutlineClock, HiOutlineExclamation, HiOutlineExclamationCircle } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { formatSlaDuration } from '../../utils/sla';

const ICONS = {
  warning: HiOutlineClock,
  critical: HiOutlineExclamation,
  breached: HiOutlineExclamationCircle,
};

/**
 * Replaces the row's relative-time line once a conversation's SLA clock is
 * running (state !== 'ok') — time-to-breach outranks time-since-last-message
 * for triage. Renders nothing at 'ok' (silence is the signal).
 */
const SlaCountdownChip = ({ slaState, plan }) => {
  const { t } = useLanguage();
  if (slaState.state === 'ok' || slaState.minutesRemaining === null) return null;

  const Icon = ICONS[slaState.state] || HiOutlineClock;
  const label =
    slaState.state === 'breached'
      ? `${t('chat.sla.exceeded')} +${formatSlaDuration(slaState.minutesRemaining)}`
      : `${t('chat.sla.label')}: ${formatSlaDuration(slaState.minutesRemaining)}`;
  const tierHint = plan
    ? t('chat.sla.targetHint').replace('{plan}', plan.toUpperCase()).replace('{hours}', Math.round(slaState.thresholdMinutes / 60))
    : undefined;

  return (
    <span className={`sla-chip sla-chip--${slaState.state}`} title={tierHint}>
      <Icon /> {label}
    </span>
  );
};

export default SlaCountdownChip;
