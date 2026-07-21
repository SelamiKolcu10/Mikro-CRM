import { useState } from 'react';
import { HiOutlinePlus, HiOutlineViewBoards } from 'react-icons/hi';
import { useDeals } from '../hooks/useDeals';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../config/permissions';
import DealBoard from '../components/deals/DealBoard';
import DealFormModal from '../components/deals/DealFormModal';

/**
 * Satış Pipeline sayfası — hooks/useDeals veri/optimistic mantığını taşır, bu
 * sayfa sadece render + modal orkestrasyonu yapar (Leads.jsx/Tasks.jsx ile aynı
 * ayrım, mobil port hedefi).
 */
const Deals = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { deals, loading, error, refresh, updateStage, updateDeal, createDeal } = useDeals();
  const [showForm, setShowForm] = useState(false);

  const canWrite = can(user?.role, 'deals', 'write');

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('deals.panel.title')}</h1>
          <p>{t('deals.panel.subtitle')}</p>
        </div>
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            <HiOutlinePlus /> {t('deals.panel.newDeal')}
          </button>
        )}
      </div>

      {deals.length === 0 ? (
        <div className="lead-empty-state">
          <HiOutlineViewBoards />
          <p>{t('deals.panel.empty')}</p>
        </div>
      ) : (
        <DealBoard
          deals={deals}
          canWrite={canWrite}
          onStageChange={updateStage}
          onUpdateDeal={updateDeal}
          onRefresh={refresh}
        />
      )}

      <DealFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onCreate={createDeal}
      />
    </div>
  );
};

export default Deals;
