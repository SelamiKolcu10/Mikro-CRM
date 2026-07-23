import { useState, useEffect } from 'react';
import { HiOutlinePlus, HiOutlineArchive, HiOutlineSearch, HiOutlineCube, HiOutlineChevronDown, HiOutlineChevronRight, HiOutlineShoppingCart } from 'react-icons/hi';
import { useCatalog } from '../hooks/useCatalog';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../config/permissions';
import { CURRENCY_SYMBOL } from '../config/catalog';
import CatalogForm from '../components/catalog/CatalogForm';
import toast from 'react-hot-toast';

/**
 * Ürün Kataloğu sayfası — tablo + arama + kategori filtre + CatalogForm modal.
 * Arşivlenmiş ürünler ve geçmiş satışlar ayrı bölümlerde gösterilir.
 */
const Catalog = () => {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const {
    products,
    archivedProducts,
    salesHistory,
    loading,
    error,
    refresh,
    refreshArchived,
    refreshSalesHistory,
    createProduct,
    updateProduct,
    archiveProduct,
  } = useCatalog();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showSales, setShowSales] = useState(false);

  const canWrite = can(user?.role, 'catalog', 'write');

  // Arşiv veya satışlar paneli açıldığında verileri yükle
  useEffect(() => {
    if (showArchived) refreshArchived();
  }, [showArchived, refreshArchived]);

  useEffect(() => {
    if (showSales) refreshSalesHistory();
  }, [showSales, refreshSalesHistory]);

  const handleCreate = async (payload) => {
    await createProduct(payload);
    toast.success(t('catalog.created'));
    setShowForm(false);
  };

  const handleUpdate = async (payload) => {
    await updateProduct(editProduct._id, payload);
    toast.success(t('common.saved'));
    setEditProduct(null);
  };

  const handleArchive = async (id) => {
    await archiveProduct(id);
    toast.success(t('catalog.archived'));
    // Arşiv paneli açıksa yenile
    if (showArchived) refreshArchived();
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    refresh({ q: search || undefined });
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('catalog.title')}</h1>
          <p>{t('catalog.subtitle')}</p>
        </div>
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            <HiOutlinePlus /> {t('catalog.newProduct')}
          </button>
        )}
      </div>

      <div className="catalog-toolbar">
        <form className="catalog-search" onSubmit={handleSearchSubmit}>
          <HiOutlineSearch className="search-icon" />
          <input
            type="text"
            className="form-input"
            placeholder={t('common.search')}
            value={search}
            onChange={handleSearchChange}
          />
        </form>
      </div>

      {products.length === 0 ? (
        <div className="lead-empty-state">
          <HiOutlineCube />
          <p>{t('catalog.empty')}</p>
        </div>
      ) : (
        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>{t('catalog.productName')}</th>
                <th>{t('catalog.category')}</th>
                <th>{t('catalog.sku')}</th>
                <th className="right">{t('catalog.unitPrice')}</th>
                <th className="right">{t('catalog.taxRate')}</th>
                <th>{t('catalog.unitLabel')}</th>
                {canWrite && <th className="center">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div className="catalog-product-name">
                      {p.name}
                    </div>
                    {p.description && <small className="catalog-desc">{p.description}</small>}
                  </td>
                  <td>{p.category || '-'}</td>
                  <td>{p.sku || '-'}</td>
                  <td className="right">{CURRENCY_SYMBOL[p.currency] || p.currency}{Number(p.unitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                  <td className="right">%{p.taxRate}</td>
                  <td>{t(`catalog.unit.${p.unit}`)}</td>
                  {canWrite && (
                    <td className="center">
                      <div className="catalog-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditProduct(p)}
                        >
                          {t('common.edit')}
                        </button>
                        {p.active && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleArchive(p._id)}
                            title={t('catalog.archive')}
                          >
                            <HiOutlineArchive />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Arşivlenenler Paneli ---- */}
      <div className="catalog-panel">
        <button
          type="button"
          className={`catalog-panel-toggle ${showArchived ? 'active' : ''}`}
          onClick={() => setShowArchived((prev) => !prev)}
        >
          <HiOutlineArchive />
          <span>{t('catalog.archivedSection')}</span>
          {showArchived ? <HiOutlineChevronDown className="catalog-panel-chevron" /> : <HiOutlineChevronRight className="catalog-panel-chevron" />}
        </button>

        {showArchived && (
          <div className="catalog-panel-content">
            {archivedProducts.length === 0 ? (
              <p className="catalog-panel-empty">{t('catalog.archivedEmpty')}</p>
            ) : (
              <div className="catalog-table-wrap">
                <table className="catalog-table catalog-table--archived">
                  <thead>
                    <tr>
                      <th>{t('catalog.productName')}</th>
                      <th>{t('catalog.category')}</th>
                      <th className="right">{t('catalog.unitPrice')}</th>
                      <th>{t('catalog.unitLabel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedProducts.map((p) => (
                      <tr key={p._id} className="catalog-row--archived">
                        <td>
                          <div className="catalog-product-name">
                            {p.name}
                            <span className="catalog-archived-badge">{t('catalog.archivedBadge')}</span>
                          </div>
                          {p.description && <small className="catalog-desc">{p.description}</small>}
                        </td>
                        <td>{p.category || '-'}</td>
                        <td className="right">{CURRENCY_SYMBOL[p.currency] || p.currency}{Number(p.unitPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td>{t(`catalog.unit.${p.unit}`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Geçmiş Satışlar Paneli ---- */}
      <div className="catalog-panel">
        <button
          type="button"
          className={`catalog-panel-toggle ${showSales ? 'active' : ''}`}
          onClick={() => setShowSales((prev) => !prev)}
        >
          <HiOutlineShoppingCart />
          <span>{t('catalog.salesHistory')}</span>
          {showSales ? <HiOutlineChevronDown className="catalog-panel-chevron" /> : <HiOutlineChevronRight className="catalog-panel-chevron" />}
        </button>

        {showSales && (
          <div className="catalog-panel-content">
            {salesHistory.length === 0 ? (
              <p className="catalog-panel-empty">{t('catalog.salesHistoryEmpty')}</p>
            ) : (
              <div className="catalog-table-wrap">
                <table className="catalog-table catalog-table--sales">
                  <thead>
                    <tr>
                      <th>{t('catalog.salesQuote')}</th>
                      <th>{t('catalog.productName')}</th>
                      <th>{t('catalog.salesCustomer')}</th>
                      <th className="right">{t('catalog.salesQty')}</th>
                      <th className="right">{t('catalog.salesTotal')}</th>
                      <th>{t('catalog.salesStatus')}</th>
                      <th>{t('catalog.salesDate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesHistory.map((s, idx) => (
                      <tr key={`${s.quoteId}-${idx}`}>
                        <td><span className="catalog-quote-number">{s.quoteNumber}</span></td>
                        <td>{s.productName}</td>
                        <td>{s.customerName}</td>
                        <td className="right">{s.quantity}</td>
                        <td className="right">{CURRENCY_SYMBOL[s.currency] || s.currency}{Number(s.total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td><span className={`catalog-sale-status catalog-sale-status--${s.status}`}>{t(`quotes.statusLabel.${s.status}`)}</span></td>
                        <td>{new Date(s.date).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {(showForm || editProduct) && (
        <CatalogForm
          product={editProduct}
          onSave={editProduct ? handleUpdate : handleCreate}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
        />
      )}
    </div>
  );
};

export default Catalog;
