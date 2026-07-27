import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { HiOutlineX, HiOutlineMail, HiOutlinePhone, HiOutlineUserAdd, HiOutlineBadgeCheck, HiOutlineTrendingUp, HiOutlineArrowRight } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LEAD_STATUSES, LEAD_STATUS_CLASS, LEAD_TEMPERATURE_CLASS } from '../../config/leads';
import { can, DEPARTMENTS, DEPARTMENT_LABELS } from '../../config/permissions';
import { assignableDepartmentsFor } from '../../utils/leadScope';
import { summarizeLead } from '../../utils/leadSummary';
import { useLeadEvents } from '../../hooks/useLeadEvents';
import ConvertLeadModal from '../deals/ConvertLeadModal';
import taskService from '../../services/taskService';
import toast from 'react-hot-toast';

const EVENT_LABEL_KEY = {
  created: 'leads.timeline.created',
  status_changed: 'leads.timeline.statusChanged',
  assigned: 'leads.timeline.assigned',
  note_added: 'leads.timeline.noteAdded',
  converted: 'leads.timeline.converted',
};

/**
 * Lead detay + aksiyon paneli — ProjectDrawer/EmployeePanel ile aynı portal'lı
 * merkezi-modal deseni (bkz. proje hafızası: .page-container position:fixed'i
 * hapsediyor, document.body'ye portallanmazsa navbar altında/yanlış yerde
 * kalır — iki kez yaşandı, üçüncüsü olmasın diye burada da aynısı).
 */
const LeadDetailDrawer = ({ lead, onClose, onStatusChange, onAssign }) => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const drawerRef = useRef(null);
  const [note, setNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [assignDepartment, setAssignDepartment] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [departmentUsers, setDepartmentUsers] = useState([]);
  const { events, loading: eventsLoading, addNote, refresh: refreshEvents } = useLeadEvents(lead?._id);

  // super_admin tüm departmanlara, departman lideri sadece kendisininkine
  // atayabilir (bkz. utils/leadScope.js — backend/utils/leadScope.js'in aynası).
  const assignableDepartments = assignableDepartmentsFor(user, DEPARTMENTS);
  const canAssign = assignableDepartments.length > 0;

  useEffect(() => {
    if (!lead) return;
    setNote('');
    setAssignDepartment('');
    setAssigneeId('');
    drawerRef.current?.focus();
  }, [lead]);

  useEffect(() => {
    if (!lead) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lead, onClose]);

  // Departman seçilince o departmanın (onaylı) üyelerini yükle — kişi seçimi
  // kaskad ikinci adım (bkz. CreateTaskModal.jsx ile aynı desen).
  useEffect(() => {
    setAssigneeId('');
    if (!assignDepartment) {
      setDepartmentUsers([]);
      return;
    }
    let cancelled = false;
    taskService.getAssignableUsers(assignDepartment).then((res) => {
      if (!cancelled) setDepartmentUsers(res.data.data || []);
    }).catch(() => {
      if (!cancelled) setDepartmentUsers([]);
    });
    return () => { cancelled = true; };
  }, [assignDepartment]);

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

  const handleAssign = async () => {
    if (!assignDepartment) return;
    setAssigning(true);
    try {
      await onAssign(lead._id, assignDepartment, assigneeId || null);
      refreshEvents();
      setAssigneeId('');
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

              {/* Satış: nitelikli lead → Deal. Dönüştürülmüşse rozet+link, değilse
                  (yetkiliyse) dönüştür butonu. Dönüşüm Customer'ı da oluşturur. */}
              {lead.convertedDeal ? (
                <button
                  type="button"
                  className="lead-converted-badge"
                  onClick={() => { onClose(); navigate('/deals'); }}
                >
                  <HiOutlineTrendingUp /> {t('leads.detail.convertedToDeal')} <HiOutlineArrowRight />
                </button>
              ) : (
                canWrite && (
                  <button type="button" className="btn btn-primary btn-sm lead-convert-btn" onClick={() => setShowConvert(true)}>
                    <HiOutlineTrendingUp /> {t('leads.detail.convertToDeal')}
                  </button>
                )
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
                {lead.assignedDepartment ? (
                  <span className="frac-label">
                    {t('leads.detail.assignedDepartment')}: <strong>{t(DEPARTMENT_LABELS[lead.assignedDepartment])}</strong>
                    {lead.assignedTo && <> · {t('leads.detail.assignedTo')}: <strong>{lead.assignedTo.name}</strong></>}
                  </span>
                ) : (
                  <span className="frac-label">{t('leads.detail.unassigned')}</span>
                )}

                {/* super_admin her departmana, departman lideri sadece kendisininkine
                    atama yapabilir (assignableDepartments boşsa hiç gösterilmez) */}
                {canAssign && (
                  <div className="lead-assign-select">
                    <select
                      className="form-select"
                      value={assignDepartment}
                      onChange={(e) => setAssignDepartment(e.target.value)}
                    >
                      <option value="">{t('leads.detail.selectDepartment')}</option>
                      {assignableDepartments.map((d) => (
                        <option key={d} value={d}>{t(DEPARTMENT_LABELS[d])}</option>
                      ))}
                    </select>
                    {assignDepartment && (
                      <select
                        className="form-select"
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                      >
                        <option value="">{t('leads.detail.selectAssignee')}</option>
                        {departmentUsers.map((u) => (
                          <option key={u._id} value={u._id}>{u.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAssign}
                      disabled={assigning || !assignDepartment}
                    >
                      <HiOutlineUserAdd /> {t('leads.detail.assignTo')}
                    </button>
                  </div>
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
                          {ev.action === 'assigned' && <span>{t(EVENT_LABEL_KEY.assigned)} {ev.note || ''}</span>}
                          {ev.action === 'converted' && <span>{t(EVENT_LABEL_KEY.converted)}</span>}
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

      <ConvertLeadModal
        lead={showConvert ? lead : null}
        isOpen={showConvert}
        onClose={() => setShowConvert(false)}
        onConverted={() => { onClose(); navigate('/deals'); }}
      />
    </>,
    document.body
  );
};

export default LeadDetailDrawer;
