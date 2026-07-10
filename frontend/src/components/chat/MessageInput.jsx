import { useState } from 'react';
import { HiOutlinePaperAirplane } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

const MessageInput = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const { t } = useLanguage();

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-sm)', padding: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
      <textarea
        className="form-input"
        rows={1}
        style={{ resize: 'none', flex: 1 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('chat.messagePlaceholder')}
      />
      <button type="button" className="btn btn-primary" onClick={submit} disabled={!value.trim()} title={t('chat.send')}>
        <HiOutlinePaperAirplane />
      </button>
    </div>
  );
};

export default MessageInput;
