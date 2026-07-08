import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import portalProfileService from '../../services/portalProfileService';
import toast from 'react-hot-toast';

const PortalProfile = () => {
  const { customerUser, logout } = useAuth();

  const [profileForm, setProfileForm] = useState({
    name: customerUser?.customer?.name || '',
    email: customerUser?.customer?.email || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await portalProfileService.updateProfile(profileForm);
      toast.success('Bilgileriniz güncellendi ✅');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bir hata oluştu');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Yeni şifreler eşleşmiyor.');
      return;
    }

    setSavingPassword(true);
    try {
      await portalProfileService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Şifreniz güncellendi. Lütfen tekrar giriş yapın.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(logout, 1200);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bir hata oluştu');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>👤 Profilim</h1>
          <p>Bilgilerinizi ve şifrenizi buradan güncelleyebilirsiniz</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h3>İletişim Bilgileri</h3>
          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label className="form-label">Ad Soyad / Şirket</label>
              <input
                type="text"
                className="form-input"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">E-posta</label>
              <input
                type="email"
                className="form-input"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                required
              />
              <span className="form-hint">E-postanızı değiştirirseniz, bir sonraki girişte yeni e-postanızı kullanmanız gerekir.</span>
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </form>
        </div>

        <div className="chart-card">
          <h3>Şifre Değiştir</h3>
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label className="form-label">Mevcut Şifre</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Yeni Şifre</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                minLength={8}
                required
              />
              <span className="form-hint">En az 8 karakter olmalıdır.</span>
            </div>
            <div className="form-group">
              <label className="form-label">Yeni Şifre (Tekrar)</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                minLength={8}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingPassword}>
              {savingPassword ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default PortalProfile;
