import { useState } from 'react';
import { HiOutlinePlus, HiOutlineArchive, HiOutlineSearch, HiOutlineCube } from 'react-icons/hi';
import { useCatalog } from '../hooks/useCatalog';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { can } from '../config/permissions';
import { CURRENCY_SYMBOL } from '../config/catalog';
import CatalogForm from '../components/catalog/CatalogForm';
import toast from 'react-hot-toast';

/**
 * Ürün Kataloğu sayfası — tablo + arama + kategori filtre + CatalogForm modal.
 */
const Catalog = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { products, loading, error, refresh, createProduct, updateProduct, archiveProduct } = useCatalog();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const canWrite = can(user?.role, 'catalog', 'write');

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
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  const handleToggleArchived = () => {
    const next = !showArchived;
    setShowArchived(next);
    refresh({ active: next ? 'all' : undefined, q: search || undefined });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    refresh({ q: search || undefined, active: showArchived ? 'all' : undefined });
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
        <label className="catalog-archive-toggle">
          <input type="checkbox" checked={showArchived} onChange={handleToggleArchived} />
          <span>{t('catalog.showArchived')}</span>
        </label>
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
                <th>{t('catalog.unit')}</th>
                {canWrite && <th className="center">{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id} className={!p.active ? 'catalog-row--archived' : ''}>
                  <td>
                    <div className="catalog-product-name">
                      {p.name}
                      {!p.active && <span className="catalog-archived-badge">{t('catalog.archivedBadge')}</span>}
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
