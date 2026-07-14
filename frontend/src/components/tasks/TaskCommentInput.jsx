import { useState } from 'react';
import { HiOutlinePaperAirplane } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

/** Oval input + gönder ikonu — Enter veya butonla anında yorum gönderir. */
const TaskCommentInput = ({ onSubmit }) => {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="task-comment-input" onSubmit={handleSubmit}>
      <input
        className="task-comment-input-field"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('tasks.comments.placeholder')}
        maxLength={1000}
      />
      <button
        type="submit"
        className="task-comment-send-btn"
        disabled={!text.trim() || submitting}
        aria-label={t('tasks.comments.send')}
      >
        <HiOutlinePaperAirplane />
      </button>
    </form>
  );
};

export default TaskCommentInput;
