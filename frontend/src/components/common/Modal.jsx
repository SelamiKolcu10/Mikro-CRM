import { createPortal } from 'react-dom';
import { HiOutlineX } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';

/**
 * `.modal-overlay` position:fixed'dir; `.page-container`'ın giriş animasyonu
 * (fadeInUp) `transform` kullandığı için sayfa DOM'unda render edilirse
 * containing-block'u ele geçirir ve overlay viewport yerine sayfa akışına
 * göre konumlanır (uzun sayfalarda modal "aşağıda" açılmış gibi görünür —
 * bkz. proje hafızası: position:fixed overlay'ler her zaman document.body'ye
 * portallanmalı). Bu, Modal'ı kullanan HER yeri (13+ çağıran) tek seferde düzeltir.
 */
const Modal = ({ isOpen, onClose, title, children, footer }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label={t('common.close')}><HiOutlineX /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
