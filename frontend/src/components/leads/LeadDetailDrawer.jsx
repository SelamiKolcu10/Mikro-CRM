import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineX, HiOutlineMail, HiOutlinePhone, HiOutlineUserAdd, HiOutlineBadgeCheck } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LEAD_STATUSES, LEAD_STATUS_CLASS, LEAD_TEMPERATURE_CLASS } from '../../config/leads';
import { can } from '../../config/permissions';
import { summarizeLead } from '../../utils/leadSummary';
import { useLeadEvents } from '../../hooks/useLeadEvents';
import toast from 'react-hot-toast';

const EVENT_LABEL_KEY = {
  created: 'leads.timeline.created',
  status_changed: 'leads.timeline.statusChanged',
  assigned: 'leads.timeline.assigned',
  note_added: 'leads.timeline.noteAdded',
};

/**
 * Lead detay + aksiyon paneli — ProjectDrawer/EmployeePanel ile aynı portal'lı
 * merkezi-modal deseni (bkz. proje hafızası: .page-container position:fixed'i
 * hapsediyor, document.body'ye portallanmazsa navbar altında/yanlış yerde
 * kalır — iki kez yaşandı, üçüncüsü olmasın diye burada da aynısı).
 */
const LeadDetailDrawer = ({ lead, onClose, onStatusChange, onAssignToMe }) => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const drawerRef = useRef(null);
  const [note, setNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const { events, loading: eventsLoading, addNote, refresh: refreshEvents } = useLeadEvents(lead?._id);

  useEffect(() => {
    if (!lead) return;
    setNote('');
    drawerRef.current?.focus();
  }, [lead]);

  useEffect(() => {
    if (!lead) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lead, onClose]);

  if (!lead) return null;

  const handleStatusChange = async (e) => {
    const status = e.target.value;
    setChangingStatus(true);
    try {
      await onStatusChange(lead._id, status);
      // Sunucu bu aksiyonda bir LeadEvent(status_changed) yazdı ama bu
      // hook'un `events` listesi lead._id değişmediği için otomatik
      // tazelenmez (useEffect'in bağımlılığı sadece leadId) — elle tazele.
      refreshEvents();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setChangingStatus(false);
    }
  };

  const handleAssignToMe = async () => {
    setAssigning(true);
    try {
      await onAssignToMe(lead._id);
      refreshEvents();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setAssigning(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmittingNote(true);
    try {
      await addNote(note.trim());
      setNote('');
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSubmittingNote(false);
    }
  };

  const isAssignedToMe = lead.assignedTo?._id === user?._id;
  // Salt-okunur roller (accountant/support/intern) paneli görür ama durum/
  // atama/not değiştiremez — kontroller gizlenir (backend de zaten reddeder).
  const canWrite = can(user?.role, 'leads', 'write');

  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={onClose}>
        <div
          className="project-drawer lead-detail-drawer"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={drawerRef}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="project-drawer-header lead-drawer-header">
            <div className="lead-drawer-heading">
              <h2>{lead.name}</h2>
              <div className="lead-drawer-meta">
                <span className={`lead-temp-badge ${LEAD_TEMPERATURE_CLASS[lead.temperature]}`}>
                  <span className="lead-temp-dot" />
                  {t(`leads.temperature.${lead.temperature}`)} · {lead.score}
                </span>
                <span className={`lead-status-badge ${LEAD_STATUS_CLASS[lead.status]}`}>
                  {t(`leads.status.${lead.status}`)}
                </span>
              </div>
            </div>
            <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
              <HiOutlineX />
            </button>
          </div>

          <div className="project-drawer-body">
            <section className="project-drawer-section">
              <p className="lead-detail-summary">{summarizeLead(lead, t)}</p>
              <div className="lead-detail-contact">
                <a className="lead-contact-chip" href={`mailto:${lead.email}`}><HiOutlineMail /> {lead.email}</a>
                {lead.phone && <a className="lead-contact-chip" href={`tel:${lead.phone}`}><HiOutlinePhone /> {lead.phone}</a>}
              </div>
              {lead.linkedCustomer && (
                <span className="lead-customer-badge">
                  <HiOutlineBadgeCheck /> {t('leads.detail.existingCustomer')}: <strong>{lead.linkedCustomer.name}</strong>
                </span>
              )}
            </section>

            <section className="project-drawer-section">
              <span className="form-label">{t('leads.detail.message')}</span>
              <div className="lead-message-card">{lead.message}</div>
            </section>

            <section className="project-drawer-section">
              <span className="form-label">{t('leads.detail.status')}</span>
              {canWrite ? (
                <select className="form-select" value={lead.status} onChange={handleStatusChange} disabled={changingStatus}>
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`leads.status.${s}`)}</option>
                  ))}
                </select>
              ) : (
                <span className={`lead-status-badge ${LEAD_STATUS_CLASS[lead.status]}`}>
                  {t(`leads.status.${lead.status}`)}
                </span>
              )}

              <div className="lead-detail-assign">
                {lead.assignedTo ? (
                  <span className="frac-label">{t('leads.detail.assignedTo')}: <strong>{lead.assignedTo.name}</strong></span>
                ) : (
                  <span className="frac-label">{t('leads.detail.unassigned')}</span>
                )}
                {canWrite && !isAssignedToMe && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAssignToMe} disabled={assigning}>
                    <HiOutlineUserAdd /> {t('leads.detail.assignToMe')}
                  </button>
                )}
              </div>
            </section>

            <section className="project-drawer-section">
              <span className="form-label">{t('leads.detail.timeline')}</span>
              {canWrite && (
                <form className="lead-note-form" onSubmit={handleAddNote}>
                  <textarea
                    className="form-textarea"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('leads.detail.notePlaceholder')}
                    maxLength={1000}
                    rows={2}
                  />
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={submittingNote || !note.trim()}>
                    {t('leads.detail.addNote')}
                  </button>
                </form>
              )}

              {eventsLoading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
              ) : events.length === 0 ? (
                <p className="task-comment-empty">{t('leads.detail.noEvents')}</p>
              ) : (
                <ul className="lead-timeline">
                  {events.map((ev) => (
                    <li key={ev._id} className={`lead-timeline-item lead-timeline--${ev.action}`}>
                      <span className="lead-timeline-dot" aria-hidden="true" />
                      <div className="lead-timeline-content">
                        <div className="lead-timeline-top">
                          <strong>{ev.actorName}</strong>
                          <time className="lead-timeline-time">
                            {new Date(ev.createdAt).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US')}
                          </time>
                        </div>
                        <div className="lead-timeline-text">
                          {ev.action === 'status_changed' && (
                            <span>
                              {t(EVENT_LABEL_KEY.status_changed)}{' '}
                              {ev.fromStatus && <><span className={`lead-status-chip ${LEAD_STATUS_CLASS[ev.fromStatus]}`}>{t(`leads.status.${ev.fromStatus}`)}</span> → </>}
                              <span className={`lead-status-chip ${LEAD_STATUS_CLASS[ev.toStatus]}`}>{t(`leads.status.${ev.toStatus}`)}</span>
                            </span>
                          )}
                          {ev.action === 'created' && <span>{t(EVENT_LABEL_KEY.created)}</span>}
                          {ev.action === 'assigned' && <span>{t(EVENT_LABEL_KEY.assigned)}</span>}
                          {ev.action === 'note_added' && <span className="lead-timeline-note">{ev.note}</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default LeadDetailDrawer;
