import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineExclamationCircle, HiX } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSocket } from '../../context/SocketContext';
import { ROLES } from '../../config/permissions';
import chatService from '../../services/chatService';
import { formatSlaDuration } from '../../utils/sla';

/**
 * SUPER_ADMIN-only, app-level (mounted next to ReadOnlyBanner in Layout).
 * Dismissable per-session — dismissing hides the currently-visible set, but
 * a *new* escalation (arriving via the socket event) is never in the
 * dismissed set, so the banner naturally reappears when the breach set
 * changes rather than staying silenced forever.
 */
const EscalationBanner = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { socket } = useSocket();
  const [escalations, setEscalations] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => new Set());

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const fetchEscalations = useCallback(() => {
    chatService.getEscalations().then((res) => setEscalations(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isSuperAdmin) fetchEscalations();
  }, [isSuperAdmin, fetchEscalations]);

  useEffect(() => {
    if (!socket || !isSuperAdmin) return undefined;
    socket.on('conversation:escalated', fetchEscalations);
    return () => socket.off('conversation:escalated', fetchEscalations);
  }, [socket, isSuperAdmin, fetchEscalations]);

  if (!isSuperAdmin) return null;

  const visible = escalations.filter((e) => !dismissedIds.has(e._id));
  if (visible.length === 0) return null;

  // Backend returns sorted -escalatedAt (newest first) — oldest is last.
  const oldest = visible[visible.length - 1];
  const overdueMinutes = oldest.escalatedAt ? (Date.now() - new Date(oldest.escalatedAt).getTime()) / 60000 : 0;

  const dismiss = () => setDismissedIds(new Set(escalations.map((e) => e._id)));

  return (
    <div className="escalation-banner">
      <HiOutlineExclamationCircle />
      <span>
        {t('chat.sla.bannerCount').replace('{count}', visible.length)}
        {' — '}
        {t('chat.sla.bannerOldest')
          .replace('{name}', oldest.customer?.name || '')
          .replace('{time}', formatSlaDuration(overdueMinutes))}
      </span>
      <Link to="/chat?sla=risk" className="btn btn-ghost btn-sm">
        {t('chat.sla.bannerCta')}
      </Link>
      <button type="button" className="btn-icon" onClick={dismiss} title={t('common.close')}>
        <HiX />
      </button>
    </div>
  );
};

export default EscalationBanner;
