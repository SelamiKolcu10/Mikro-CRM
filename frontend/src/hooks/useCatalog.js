import { useState, useEffect, useCallback } from 'react';
import catalogService from '../services/catalogService';

/**
 * Ürün Kataloğu veri/iş mantığı — useDeals.js deseni.
 * Arşivli ürünler ve satış geçmişi ayrı state'lerde tutulur.
 */
export function useCatalog() {
  const [products, setProducts] = useState([]);
  const [archivedProducts, setArchivedProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await catalogService.getAll(params);
      setProducts(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Ürünler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshArchived = useCallback(async () => {
    try {
      const res = await catalogService.getArchived();
      setArchivedProducts(res.data.data);
    } catch {
      // Hata durumunda sessizce boş bırak
      setArchivedProducts([]);
    }
  }, []);

  const refreshSalesHistory = useCallback(async () => {
    try {
      const res = await catalogService.getSalesSummary();
      setSalesHistory(res.data.data);
    } catch {
      setSalesHistory([]);
    }
  }, []);

  const createProduct = useCallback(async (payload) => {
    const res = await catalogService.create(payload);
    setProducts((prev) => [res.data.data, ...prev]);
    return res.data.data;
  }, []);

  const updateProduct = useCallback(async (id, payload) => {
    const res = await catalogService.update(id, payload);
    setProducts((prev) => prev.map((p) => (p._id === id ? res.data.data : p)));
    return res.data.data;
  }, []);

  const archiveProduct = useCallback(async (id) => {
    await catalogService.archive(id);
    setProducts((prev) => prev.filter((p) => p._id !== id));
  }, []);

  return {
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
  };
}
