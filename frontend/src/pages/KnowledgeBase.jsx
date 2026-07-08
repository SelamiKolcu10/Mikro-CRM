import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import knowledgeBaseService from '../services/knowledgeBaseService';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PermissionGate from '../components/auth/PermissionGate';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch } from 'react-icons/hi';

const initialForm = { title: '', content: '', category: 'Genel' };

const KnowledgeBase = () => {
  const { t } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState(null);

  const fetchArticles = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const res = await knowledgeBaseService.getAll(params);
      setArticles(res.data.data);
    } catch (err) {
      toast.error(t('common.loadError'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (article) => {
    setEditingId(article._id);
    setForm({ title: article.title, content: article.content, category: article.category });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await knowledgeBaseService.update(editingId, form);
        toast.success(t('common.update') + ' ✅');
      } else {
        await knowledgeBaseService.create(form);
        toast.success(t('common.create') + ' ✅');
      }
      setModalOpen(false);
      setSelected(null);
      fetchArticles();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await knowledgeBaseService.delete(deleteId);
      toast.success(t('common.delete') + ' ✅');
      setDeleteId(null);
      setSelected(null);
      fetchArticles();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>📚 {t('knowledgeBase.title')}</h1>
          <p>{t('knowledgeBase.subtitle')}</p>
        </div>
        <PermissionGate resource="knowledgeBase" action="write">
          <button className="btn btn-primary" onClick={openCreateModal}>
            <HiOutlinePlus /> {t('knowledgeBase.newArticle')}
          </button>
        </PermissionGate>
      </div>

      <div className="table-container" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="search-bar">
          <HiOutlineSearch className="search-icon" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="table-container">
          <div className="table-empty">
            <div className="table-empty-icon">📚</div>
            <p>{t('knowledgeBase.noArticles')}</p>
          </div>
        </div>
      ) : (
        <div className="dashboard-grid">
          {articles.map((article) => (
            <div
              className="chart-card"
              key={article._id}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelected(article)}
            >
              <h3>{article.title}</h3>
              <span className="badge badge-free">{article.category}</span>
              <p style={{ marginTop: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                {article.content.slice(0, 140)}{article.content.length > 140 ? '…' : ''}
              </p>
              <div style={{ marginTop: 'var(--space-sm)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {t('knowledgeBase.lastUpdated')}: {new Date(article.updatedAt).toLocaleDateString('tr-TR')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail view */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        footer={
          <PermissionGate resource="knowledgeBase" action="write">
            <button className="btn btn-secondary" onClick={() => { openEditModal(selected); }}>
              <HiOutlinePencil /> {t('common.edit')}
            </button>
            <button className="btn btn-danger" onClick={() => setDeleteId(selected._id)}>
              <HiOutlineTrash /> {t('common.delete')}
            </button>
          </PermissionGate>
        }
      >
        {selected && (
          <div>
            <span className="badge badge-free">{selected.category}</span>
            <p style={{ marginTop: 'var(--space-md)', whiteSpace: 'pre-wrap' }}>{selected.content}</p>
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('knowledgeBase.editArticle') : t('knowledgeBase.newArticle')}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? t('common.loading') : editingId ? t('common.update') : t('common.create')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('knowledgeBase.articleTitle')} *</label>
            <input
              type="text"
              className="form-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('knowledgeBase.category')}</label>
            <input
              type="text"
              className="form-input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('knowledgeBase.content')} *</label>
            <textarea
              className="form-textarea"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows="8"
              required
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('common.confirm')}
        message={t('knowledgeBase.deleteWarning')}
      />
    </>
  );
};

export default KnowledgeBase;
