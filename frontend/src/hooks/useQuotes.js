import { useState, useEffect, useCallback } from 'react';
import quoteService from '../services/quoteService';

/**
 * Teklif listesi hook'u — useDeals.js deseni.
 */
export function useQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await quoteService.getAll(params);
      setQuotes(res.data.data.items || res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Teklifler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createQuote = useCallback(async (payload) => {
    const res = await quoteService.create(payload);
    setQuotes((prev) => [res.data.data, ...prev]);
    return res.data.data;
  }, []);

  const updateQuote = useCallback(async (id, payload) => {
    const res = await quoteService.update(id, payload);
    setQuotes((prev) => prev.map((q) => (q._id === id ? res.data.data : q)));
    return res.data.data;
  }, []);

  const sendQuote = useCallback(async (id) => {
    const res = await quoteService.send(id);
    setQuotes((prev) => prev.map((q) => (q._id === id ? res.data.data : q)));
    return res.data.data;
  }, []);

  const reviseQuote = useCallback(async (id) => {
    const res = await quoteService.revise(id);
    setQuotes((prev) => [res.data.data, ...prev]);
    return res.data.data;
  }, []);

  const deleteQuote = useCallback(async (id) => {
    await quoteService.delete(id);
    setQuotes((prev) => prev.filter((q) => q._id !== id));
  }, []);

  return { quotes, loading, error, refresh, createQuote, updateQuote, sendQuote, reviseQuote, deleteQuote };
}
