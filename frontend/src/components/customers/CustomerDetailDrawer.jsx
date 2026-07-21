import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineX, HiOutlineOfficeBuilding } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { can } from '../../config/permissions';
import { useCustomerTimeline } from '../../hooks/useCustomerTimeline';
import CustomerTimeline from './CustomerTimeline';
import LogActivityForm from './LogActivityForm';

/**
 * Müşteri detay + birleşik aktivite timeline'ı — LeadDetailDrawer/
 * DealDetailDrawer ile aynı portal'lı merkezi-modal deseni (bkz. proje
 * hafızası: .page-container position:fixed'i hapsediyor, document.body'ye
 * portallanmazsa navbar altında/yanlış yerde kalır). Tasarım spec'i:
 * docs/superpowers/specs/2026-07-22-customer-timeline-design.md §4.
 */
const CustomerDetailDrawer = ({ customer, onClose }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const drawerRef = useRef(null);
  const { items, loading, loadingMore, hasMore, loadMore, logActivity } = useCustomerTimeline(customer?._id);

  useEffect(() => {
    if (!customer) return;
    drawerRef.current?.focus();
  }, [customer]);

  useEffect(() => {
    if (!customer) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [customer, onClose]);

  if (!customer) return null;

  const canLog = can(user?.role, 'customers', 'write');

  const handleLogActivity = async (type, note) => {
    try {
      await logActivity(type, note);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
      throw err;
    }
  };

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="project-drawer customer-detail-drawer"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-drawer-header customer-drawer-header">
          <div className="customer-drawer-heading">
            <h2>{customer.name}</h2>
            <div className="customer-drawer-meta">
              {customer.company && (
                <span className="deal-fact deal-fact--muted"><HiOutlineOfficeBuilding /> {customer.company}</span>
              )}
              <span className={`badge badge-${customer.plan}`}>{t(`customers.plans.${customer.plan}`).toUpperCase()}</span>
              <span className={`revenue-impact ${customer.mrr >= 200 ? 'high' : customer.mrr > 0 ? 'medium' : 'low'}`}>
                ${customer.mrr}{t('common.perMonth')}
              </span>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={t('common.close')}>
            <HiOutlineX />
          </button>
        </div>

        <div className="project-drawer-body">
          <section className="project-drawer-section">
            <span className="form-label">{t('customers.detail.timeline')}</span>

            {canLog && <LogActivityForm onSubmit={handleLogActivity} />}

            <CustomerTimeline
              items={items}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CustomerDetailDrawer;
