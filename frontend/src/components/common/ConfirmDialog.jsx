import { useLanguage } from '../../context/LanguageContext';
import { HiOutlineExclamation } from 'react-icons/hi';
import Modal from './Modal';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, loading }) => {
  const { t } = useLanguage();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || t('common.confirm')}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? t('common.loading') : t('common.delete')}
          </button>
        </>
      }
    >
      <div className="confirm-content">
        <div className="confirm-icon">
          <HiOutlineExclamation />
        </div>
        <p>{message}</p>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
