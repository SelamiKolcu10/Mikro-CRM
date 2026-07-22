import { useState } from 'react';
import { HiOutlinePlus, HiOutlineDocumentText } from 'react-icons/hi';
import { useQuotes } from '../hooks/useQuotes';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../config/permissions';
import { QUOTE_STATUS_CLASS } from '../config/quotes';
import { CURRENCY_SYMBOL } from '../config/catalog';
import QuoteBuilder from '../components/quotes/QuoteBuilder';
import QuoteDetailDrawer from '../components/quotes/QuoteDetailDrawer';
import toast from 'react-hot-toast';

/**
 * Teklifler sayfası — teklif listesi + QuoteBuilder modal + QuoteDetailDrawer.
 */
const Quotes = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { quotes, loading, error, refresh, createQuote, updateQuote, sendQuote, reviseQuote, deleteQuote } = useQuotes();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editQuote, setEditQuote] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);

  const canWrite = can(user?.role, 'quotes', 'write');

  const handleCreate = async (payload) => {
    await createQuote(payload);
    toast.success(t('quotes.created'));
    setShowBuilder(false);
  };

  const handleUpdate = async (id, payload) => {
    await updateQuote(id, payload);
    toast.success(t('common.saved'));
    setEditQuote(null);
  };

  const handleSend = async (id) => {
    const updated = await sendQuote(id);
    toast.success(t('quotes.sent'));
    setSelectedQuote(updated);
    return updated;
  };

  const handleRevise = async (id) => {
    const revised = await reviseQuote(id);
    toast.success(t('quotes.revised'));
    setSelectedQuote(revised);
    return revised;
  };

  const handleDelete = async (id) => {
    await deleteQuote(id);
    toast.success(t('quotes.deleted'));
    setSelectedQuote(null);
  };

  const formatMoney = (amount, currency) => {
    const sym = CURRENCY_SYMBOL[currency] || currency;
    return `${sym}${Number(amount || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })}`;
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('quotes.title')}</h1>
          <p>{t('quotes.subtitle')}</p>
        </div>
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => setShowBuilder(true)}>
            <HiOutlinePlus /> {t('quotes.newQuote')}
          </button>
        )}
      </div>

      {quotes.length === 0 ? (
        <div className="lead-empty-state">
          <HiOutlineDocumentText />
          <p>{t('quotes.empty')}</p>
        </div>
      ) : (
        <div className="catalog-table-wrap">
          <table className="catalog-table quotes-table">
            <thead>
              <tr>
                <th>{t('quotes.number')}</th>
                <th>{t('quotes.customer')}</th>
                <th>{t('quotes.status')}</th>
                <th className="right">{t('quotes.total')}</th>
                <th>{t('quotes.date')}</th>
                <th>{t('quotes.validUntil')}</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr
                  key={q._id}
                  className="quotes-row"
                  onClick={() => setSelectedQuote(q)}
                >
                  <td className="quotes-number">{q.quoteNumber}</td>
                  <td>{q.customer?.name || q.customer?.company || '-'}</td>
                  <td>
                    <span className={`quote-status-badge ${QUOTE_STATUS_CLASS[q.status]}`}>
                      {t(`quotes.statusLabel.${q.status}`)}
                    </span>
                  </td>
                  <td className="right">{formatMoney(q.grandTotal, q.currency)}</td>
                  <td>{new Date(q.createdAt).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}</td>
                  <td>{q.validUntil ? new Date(q.validUntil).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showBuilder || editQuote) && (
        <QuoteBuilder
          quote={editQuote}
          onSave={editQuote ? (payload) => handleUpdate(editQuote._id, payload) : handleCreate}
          onClose={() => { setShowBuilder(false); setEditQuote(null); }}
        />
      )}

      <QuoteDetailDrawer
        quote={selectedQuote}
        canWrite={canWrite}
        onClose={() => setSelectedQuote(null)}
        onSend={handleSend}
        onRevise={handleRevise}
        onDelete={handleDelete}
        onEdit={(q) => { setSelectedQuote(null); setEditQuote(q); }}
        onRefresh={refresh}
      />
    </div>
  );
};

export default Quotes;
