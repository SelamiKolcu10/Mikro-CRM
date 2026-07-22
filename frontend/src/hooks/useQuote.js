import { useState, useEffect, useCallback } from 'react';
import quoteService from '../services/quoteService';

/**
 * Tek teklif detay hook'u — useDealEvents deseni.
 */
export function useQuote(id) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await quoteService.getById(id);
      setQuote(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Teklif yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { quote, loading, error, refresh, setQuote };
}
