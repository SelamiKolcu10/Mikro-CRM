import { useState, useEffect, useRef } from 'react';
import { HiOutlineCamera, HiOutlineUpload, HiOutlinePhone, HiOutlineLockClosed } from 'react-icons/hi';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { useLanguage } from '../context/LanguageContext';
import { ROLE_LABELS, DEPARTMENT_LABELS } from '../config/permissions';
import { formatTenureSpan } from '../utils/tenure';
import userService from '../services/userService';
import EmployeeAvatar from '../components/users/EmployeeAvatar';
import DeveloperTree from '../components/users/DeveloperTree';
import toast from 'react-hot-toast';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Self-servis "Profilim" sayfası — herkes kendi profiline buradan ulaşır
 * (Çalışan Dizini'nin aksine tüm ekibi göremez, bkz. tasarım kararı).
 * Fotoğraf ham olarak yüklenir; AI vektör-avatar dönüştürme adımı bilerek
 * kapsam dışı bırakıldı (sonraki iterasyon).
 */
const Profile = () => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ phone: '', linkedin: '', github: '' });
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const loadProfile = () => {
    userService.getMyProfile()
      .then((res) => {
        setProfile(res.data.data);
        setForm({
          phone: res.data.data.personalInfo?.phone || '',
          linkedin: res.data.data.personalInfo?.linkedin || '',
          github: res.data.data.personalInfo?.github || '',
        });
      })
      .catch(() => toast.error(t('common.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProfile(); }, []);

  if (loading || !profile) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  const resetUpload = () => {
    setPendingFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t('profile.fileTooLarge'));
      return;
    }
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSavePhoto = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const res = await userService.uploadMyAvatar(pendingFile);
      setProfile((p) => ({ ...p, personalInfo: { ...p.personalInfo, avatarUrl: res.data.data.avatarUrl } }));
      toast.success(t('profile.photoSaved'));
      resetUpload();
      setUploadOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setUploading(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSavingContact(true);
    try {
      const res = await userService.updateMyContactInfo(form);
      setProfile((p) => ({ ...p, personalInfo: res.data.data }));
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2200);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>👤 {t('profile.title')}</h1>
          <p>{t('profile.subtitle')}</p>
        </div>
      </div>

      <div className="profile-grid">
        <section className="profile-card" aria-label={t('profile.title')}>
          <div className="profile-identity">
            <button
              type="button"
              className="avatar-edit"
              aria-label={t('profile.changePhoto')}
              aria-expanded={uploadOpen}
              onClick={() => { setUploadOpen((v) => !v); if (uploadOpen) resetUpload(); }}
            >
              <EmployeeAvatar user={profile} size="xl" />
              <span className="avatar-overlay"><HiOutlineCamera size={20} /></span>
            </button>
            <div>
              <h2 className="panel-name">{profile.name}</h2>
              <div className="panel-meta">
                <span className={`pill pill--${profile.role === 'super_admin' ? 'danger' : profile.role === 'accountant' ? 'info' : profile.role === 'support' ? 'success' : 'accent'}`}>
                  {t(ROLE_LABELS[profile.role])}
                </span>
                <span className="dept">{profile.department ? t(DEPARTMENT_LABELS[profile.department]) : t('departments.none')}</span>
              </div>
              <p className="tenure-line">
                <span>{formatTenureSpan(profile.tenureMonths, profile.tenureDays)}</span>
                <span className="dot-sep">·</span>
                <span>{t('users.directory.tenureSuffix')}</span>
              </p>
            </div>
          </div>

          {uploadOpen && (
            <div className="upload-card">
              <button
                type="button"
                className={`avatar-dropzone${dragOver ? ' dragover' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              >
                <HiOutlineUpload size={20} />
                <span>{t('profile.dropHint')}</span>
                <span className="fake-btn">{t('profile.chooseFile')}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => handleFile(e.target.files[0])}
              />
              {previewUrl && (
                <div className="upload-preview">
                  <img src={previewUrl} alt="" />
                  <div>
                    <div className="file-name">{pendingFile.name}</div>
                    <div className="frac-label">{t('profile.previewHint')}</div>
                  </div>
                </div>
              )}
              <div className="upload-actions">
                <button type="button" className="btn btn-primary" disabled={!pendingFile || uploading} onClick={handleSavePhoto}>
                  {uploading ? t('common.loading') : t('common.save')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { resetUpload(); setUploadOpen(false); }}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          <form className="contact-form" onSubmit={handleContactSubmit}>
            <div className="field">
              <label htmlFor="profPhone">{t('profile.phone')}</label>
              <div className="input-wrap">
                <HiOutlinePhone />
                <input id="profPhone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="profLinkedin">{t('profile.linkedin')}</label>
              <div className="input-wrap">
                <FaLinkedin />
                <input id="profLinkedin" type="url" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." />
              </div>
            </div>
            <div className="field">
              <label htmlFor="profGithub">{t('profile.github')}</label>
              <div className="input-wrap">
                <FaGithub />
                <input id="profGithub" type="url" value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })} placeholder="https://github.com/..." />
              </div>
            </div>
            <p className="visibility-note"><HiOutlineLockClosed /><span>{t('profile.visibilityNote')}</span></p>
            <div className="form-footer">
              <button type="submit" className="btn btn-primary" disabled={savingContact}>
                {savingContact ? t('common.loading') : t('common.save')}
              </button>
              {contactSaved && <span className="inline-toast show">✓ {t('profile.contactSaved')}</span>}
            </div>
          </form>
        </section>

        <section className="profile-tree" aria-label={t('users.tree.contributedProjects')}>
          <DeveloperTree tenureMonths={profile.tenureMonths} tenureDays={profile.tenureDays} projects={profile.projects} />
        </section>
      </div>
    </>
  );
};

export default Profile;
