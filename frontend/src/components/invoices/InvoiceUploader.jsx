import { useState, useRef, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { HiOutlineCloudUpload, HiOutlinePhotograph, HiOutlineX } from 'react-icons/hi';

const InvoiceUploader = ({ onUpload, uploading }) => {
  const { t } = useLanguage();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    );
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const handleUploadClick = async () => {
    if (selectedFiles.length > 0 && onUpload) {
      const success = await onUpload(selectedFiles);
      if (success !== false) {
        setSelectedFiles([]);
      }
    }
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="invoice-uploader">
      {/* Drop Zone */}
      <div
        className={`dropzone ${dragActive ? 'dropzone-active' : ''} ${uploading ? 'dropzone-uploading' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        id="invoice-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          id="invoice-file-input"
        />

        <div className="dropzone-content">
          {uploading ? (
            <>
              <div className="dropzone-spinner">
                <div className="spinner" />
              </div>
              <p className="dropzone-text">{t('invoices.processing')}</p>
            </>
          ) : (
            <>
              <div className="dropzone-icon">
                <HiOutlineCloudUpload />
              </div>
              <p className="dropzone-text">{t('invoices.dropzone')}</p>
              <p className="dropzone-hint">{t('invoices.dropzoneHint')}</p>
            </>
          )}
        </div>
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && !uploading && (
        <div className="selected-files">
          <div className="selected-files-header">
            <span>{selectedFiles.length} {selectedFiles.length === 1 ? 'dosya' : 'dosya'}</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleUploadClick}
              disabled={uploading}
              id="upload-submit-btn"
            >
              <HiOutlineCloudUpload />
              <span>{selectedFiles.length > 1 ? t('invoices.bulkUpload') : t('invoices.upload')}</span>
            </button>
          </div>

          <div className="selected-files-list">
            {selectedFiles.map((file, idx) => (
              <div className="selected-file-item" key={`${file.name}-${idx}`}>
                <div className="file-icon">
                  <HiOutlinePhotograph />
                </div>
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                <button
                  className="btn-icon"
                  onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  title={t('common.delete')}
                >
                  <HiOutlineX />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceUploader;
