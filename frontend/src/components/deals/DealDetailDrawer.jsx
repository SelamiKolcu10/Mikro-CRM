import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineX, HiOutlineOfficeBuilding, HiOutlineUser, HiOutlineInboxIn } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useLanguage } from '../../context/LanguageContext';
import { DEAL_STAGES, DEAL_STAGE_CLASS } from '../../config/deals';
import { formatCurrency } from '../../utils/dealForecast';
import { useDealEvents } from '../../hooks/useDealEvents';
import ProgressRing from '../projects/ProgressRing';

const EVENT_LABEL_KEY = {
  created: 'deals.timeline.created',
  stage_changed: 'deals.timeline.stageChanged',
  value_changed: 'deals.timeline.valueChanged',
  note_added: 'deals.timeline.noteAdded',
  won: 'deals.timeline.won',
  lost: 'deals.timeline.lost',
  assigned: 'deals.timeline.assigned',
};

// date input <-> ISO. Boş tarih '' olarak yönetilir.
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

/**
 * Fırsat detay + aksiyon paneli — LeadDetailDrawer ile aynı portal'lı merkezi
 * modal deseni (proje hafızası: .page-container position:fixed'i hapsediyor →
 * document.body'ye portallanır). Aşama değişimi burada da mümkün (mobil/
 * erişilebilir fallback — board sürükle-bırakın alternatifi).
 */
const DealDetailDrawer = ({ deal, canWrite, onClose, onStageChange, onUpdateDeal }) => {
  const { t, lang } = useLanguage();
  const drawerRef = useRef(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [form, setForm] = useState({ title: '', value: '', probability: '', expectedCloseDate: '', lostReason: '' });
  const { events, loading: eventsLoading, addNote, refresh: refreshEvents } = useDealEvents(deal?._id);

  useEffect(() => {
    if (!deal) return;
    setNote('');
    setForm({
      title: deal.title || '',
      value: deal.value ?? '',
      probability: deal.probability ?? '',
      expectedCloseDate: toDateInput(deal.expectedCloseDate),
      lostReason: deal.lostReason || '',
    });
    drawerRef.current?.focus();
  }, [deal]);

  useEffect(() => {
    if (!deal) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deal, onClose]);

  if (!deal) return null;

  const handleStageChange = async (e) => {
    const stage = e.target.value;
    try {
      await onStageChange(deal._id, stage, form.lostReason);
      refreshEvents();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateDeal(deal._id, {
        title: form.title,
        value: Number(form.value),
        probability: Number(form.probability),
        expectedCloseDate: form.expectedCloseDate || '',
        lostReason: form.lostReason,
      });
      refreshEvents();
      toast.success(t('common.saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
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

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="project-drawer deal-detail-drawer"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-drawer-header deal-drawer-header">
          <div className="deal-drawer-heading">
            <h2>{deal.title}</h2>
            <div className="deal-drawer-meta">
              <span className={`deal-stage-badge ${DEAL_STAGE_CLASS[deal.stage]}`}>
                {t(`deals.stage.${deal.stage}`)}
              </span>
              <span className="deal-drawer-value">{formatCurrency(deal.value, deal.currency, lang)}</span>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <HiOutlineX />
          </button>
        </div>

        <div className="project-drawer-body">
          <section className="project-drawer-section deal-drawer-topgrid">
            <ProgressRing percent={deal.probability} />
            <div className="deal-drawer-facts">
              {deal.customer?.name && (
                <span className="deal-fact"><HiOutlineOfficeBuilding /> {deal.customer.name}</span>
              )}
              {deal.owner?.name && (
                <span className="deal-fact"><HiOutlineUser /> {deal.owner.name}</span>
              )}
              {deal.lead && (
                <span className="deal-fact deal-fact--muted"><HiOutlineInboxIn /> {t('deals.detail.fromLead')}</span>
              )}
            </div>
          </section>

          <section className="project-drawer-section">
            <span className="form-label">{t('deals.detail.stage')}</span>
            {canWrite ? (
              <select className="form-select" value={deal.stage} onChange={handleStageChange}>
                {DEAL_STAGES.map((s) => (
                  <option key={s} value={s}>{t(`deals.stage.${s}`)}</option>
                ))}
              </select>
            ) : (
              <span className={`deal-stage-badge ${DEAL_STAGE_CLASS[deal.stage]}`}>{t(`deals.stage.${deal.stage}`)}</span>
            )}
          </section>

          {canWrite && (
            <section className="project-drawer-section">
              <span className="form-label">{t('deals.detail.details')}</span>
              <form className="deal-edit-form" onSubmit={handleSaveDetails}>
                <label className="deal-edit-field">
                  <span>{t('deals.detail.title')}</span>
                  <input className="form-input" type="text" value={form.title} onChange={setField('title')} maxLength={150} />
                </label>
                <div className="deal-edit-row">
                  <label className="deal-edit-field">
                    <span>{t('deals.detail.value')} ({deal.currency})</span>
                    <input className="form-input" type="number" min="0" value={form.value} onChange={setField('value')} />
                  </label>
                  <label className="deal-edit-field">
                    <span>{t('deals.detail.probability')} %</span>
                    <input className="form-input" type="number" min="0" max="100" value={form.probability} onChange={setField('probability')} />
                  </label>
                </div>
                <label className="deal-edit-field">
                  <span>{t('deals.detail.expectedClose')}</span>
                  <input className="form-input" type="date" value={form.expectedCloseDate} onChange={setField('expectedCloseDate')} />
                </label>
                {deal.stage === 'lost' && (
                  <label className="deal-edit-field">
                    <span>{t('deals.detail.lostReason')}</span>
                    <textarea className="form-textarea" rows={2} maxLength={500} value={form.lostReason} onChange={setField('lostReason')} />
                  </label>
                )}
                <button type="submit" className="btn btn-secondary btn-sm" disabled={saving}>
                  {t('common.save')}
                </button>
              </form>
            </section>
          )}

          <section className="project-drawer-section">
            <span className="form-label">{t('deals.detail.timeline')}</span>
            {canWrite && (
              <form className="lead-note-form" onSubmit={handleAddNote}>
                <textarea
                  className="form-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('deals.detail.notePlaceholder')}
                  maxLength={1000}
                  rows={2}
                />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={submittingNote || !note.trim()}>
                  {t('deals.detail.addNote')}
                </button>
              </form>
            )}

            {eventsLoading ? (
              <div className="loading-spinner"><div className="spinner" /></div>
            ) : events.length === 0 ? (
              <p className="task-comment-empty">{t('deals.detail.noEvents')}</p>
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
                        {(ev.action === 'stage_changed' || ev.action === 'won' || ev.action === 'lost') && (
                          <span>
                            {t(EVENT_LABEL_KEY[ev.action])}{' '}
                            {ev.fromStage && <><span className={`deal-stage-chip ${DEAL_STAGE_CLASS[ev.fromStage]}`}>{t(`deals.stage.${ev.fromStage}`)}</span> → </>}
                            {ev.toStage && <span className={`deal-stage-chip ${DEAL_STAGE_CLASS[ev.toStage]}`}>{t(`deals.stage.${ev.toStage}`)}</span>}
                          </span>
                        )}
                        {ev.action === 'created' && <span>{t(EVENT_LABEL_KEY.created)}</span>}
                        {ev.action === 'assigned' && <span>{t(EVENT_LABEL_KEY.assigned)}</span>}
                        {ev.action === 'value_changed' && (
                          <span>
                            {t(EVENT_LABEL_KEY.value_changed)}{' '}
                            {formatCurrency(ev.fromValue, deal.currency, lang)} → {formatCurrency(ev.toValue, deal.currency, lang)}
                          </span>
                        )}
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
    </div>,
    document.body
  );
};

export default DealDetailDrawer;
