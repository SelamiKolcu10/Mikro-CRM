const AVATAR_COLORS = ['#7c5cfc', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a78bfa', '#06b6d4', '#ec4899'];

function colorForId(id) {
  const str = String(id || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

const TaskAvatar = ({ user }) => {
  if (!user) return null;
  return (
    <span className="task-avatar" style={{ background: colorForId(user._id) }} title={user.name}>
      {initials(user.name)}
    </span>
  );
};

export default TaskAvatar;
