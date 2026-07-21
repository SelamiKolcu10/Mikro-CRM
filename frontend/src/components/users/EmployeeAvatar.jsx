import { useState } from 'react';
import { ASSET_BASE_URL } from '../../config/apiUrls';

// TaskAvatar.jsx ile aynı palet/hash — dizin ve panoda tutarlı renk için.
const AVATAR_COLORS = ['#7c5cfc', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a78bfa', '#06b6d4', '#ec4899'];

function colorForId(id) {
  const str = String(id || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

/** size: undefined = 40px kart avatarı, 'sm' | 'lg' | 'xl' */
const EmployeeAvatar = ({ user, size }) => {
  // Fotoğraf yüklenemezse (dosya silinmiş / URL var ama dosya yok) baş harflere
  // düş — kırık resim ikonu gösterme.
  const [imgError, setImgError] = useState(false);
  const cls = `avatar${size ? ` avatar--${size}` : ''}`;
  const avatarUrl = user?.personalInfo?.avatarUrl;
  if (avatarUrl && !imgError) {
    return (
      <div className={cls}>
        <img
          src={`${ASSET_BASE_URL}${avatarUrl}`}
          alt=""
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }
  return (
    <div className={cls} style={{ background: colorForId(user?._id) }}>
      {initials(user?.name)}
    </div>
  );
};

export default EmployeeAvatar;
