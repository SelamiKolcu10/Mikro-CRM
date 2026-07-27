import { useState } from 'react';
import { HiOutlinePaperAirplane, HiOutlineLockClosed, HiOutlineLockOpen } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

// `onSendNote` opsiyonel — yalnızca staff tarafı (ChatDashboard.jsx) geçiyor.
// PortalChat.jsx bu prop'u hiç vermiyor, o yüzden müşteri tarafında kilit
// toggle'ı render edilmez ve davranış eskisiyle birebir aynı kalır.
const MessageInput = ({ onSend, onSendNote, disabled }) => {
  const [value, setValue] = useState('');
  const [noteMode, setNoteMode] = useState(false);
  const { t } = useLanguage();

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    if (noteMode && onSendNote) onSendNote(trimmed);
    else onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={`chat-message-input ${noteMode ? 'is-note-mode' : ''}`}>
      {onSendNote && (
        <button
          type="button"
          className={`chat-note-toggle-btn ${noteMode ? 'active' : ''}`}
          onClick={() => setNoteMode((v) => !v)}
          title={noteMode ? t('chat.noteModeOn') : t('chat.noteModeOff')}
          aria-pressed={noteMode}
        >
          {noteMode ? <HiOutlineLockClosed /> : <HiOutlineLockOpen />}
        </button>
      )}
      <textarea
        className="form-input"
        rows={1}
        style={{ resize: 'none', flex: 1 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={noteMode ? t('chat.notePlaceholder') : t('chat.messagePlaceholder')}
      />
      <button
        type="button"
        className={`btn ${noteMode ? 'btn-secondary' : 'btn-primary'}`}
        onClick={submit}
        disabled={!value.trim()}
        title={noteMode ? t('chat.addNote') : t('chat.send')}
      >
        <HiOutlinePaperAirplane />
      </button>
    </div>
  );
};

export default MessageInput;
