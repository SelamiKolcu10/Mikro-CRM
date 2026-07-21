import { useState } from 'react';
import { HiOutlineAnnotation, HiOutlinePhone, HiOutlineUsers, HiOutlineMail } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { MANUAL_ACTIVITY_TYPES } from '../../config/customerEvents';

const TYPE_ICON = {
  note: HiOutlineAnnotation,
  call: HiOutlinePhone,
  meeting: HiOutlineUsers,
  email: HiOutlineMail,
};

// call/meeting'de not opsiyonel (arama/toplantının kendisi loglanır) — bkz.
// backend/validators/customerValidators.js NOTE_OPTIONAL_TYPES ile aynı kural.
const NOTE_OPTIONAL_TYPES = ['call', 'meeting'];

/**
 * Müşteri timeline'ının üstünde yaşayan manuel aktivite formu — tür seçici
 * (not/arama/toplantı/e-posta ikon-butonları) + textarea. LeadDetailDrawer'ın
 * "not ekle" formunun genişletilmiş hali (bkz. tasarım spec'i §4.4).
 */
const LogActivityForm = ({ onSubmit }) => {
  const { t } = useLanguage();
  const [type, setType] = useState('note');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const noteRequired = !NOTE_OPTIONAL_TYPES.includes(type);
  const canSubmit = !noteRequired || note.trim().length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(type, note.trim());
      setNote('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="log-activity-form" onSubmit={handleSubmit}>
      <div className="log-activity-type-picker" role="radiogroup" aria-label={t('customers.detail.activityType')}>
        {MANUAL_ACTIVITY_TYPES.map((activityType) => {
          const Icon = TYPE_ICON[activityType];
          return (
            <button
              key={activityType}
              type="button"
              className={`log-activity-type-btn ${type === activityType ? 'active' : ''}`}
              aria-pressed={type === activityType}
              onClick={() => setType(activityType)}
              title={t(`customers.detail.activityTypes.${activityType}`)}
            >
              <Icon /> {t(`customers.detail.activityTypes.${activityType}`)}
            </button>
          );
        })}
      </div>
      <textarea
        className="form-textarea"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t(noteRequired ? 'customers.detail.notePlaceholderRequired' : 'customers.detail.notePlaceholderOptional')}
        maxLength={2000}
        rows={2}
      />
      <button type="submit" className="btn btn-secondary btn-sm" disabled={submitting || !canSubmit}>
        {t('customers.detail.logActivity')}
      </button>
    </form>
  );
};

export default LogActivityForm;
