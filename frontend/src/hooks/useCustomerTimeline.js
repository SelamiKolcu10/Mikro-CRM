import { useState, useEffect, useCallback } from 'react';
import customerService from '../services/customerService';

/**
 * Müşterinin birleşik aktivite akışı (DealEvent+LeadEvent+Feedback+
 * CustomerEvent, sunucu-taraf harmanlanmış) — hooks/useDealEvents.js aynası.
 * `loadMore` cursor'lu sayfalama yapar (bkz. tasarım spec'i §3.1).
 */
export function useCustomerTimeline(customerId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  const refresh = useCallback(() => {
    if (!customerId) {
      setItems([]);
      setHasMore(false);
      setNextCursor(null);
      return;
    }
    setLoading(true);
    customerService
      .getTimeline(customerId)
      .then((res) => {
        setItems(res.data.data.items);
        setHasMore(res.data.data.hasMore);
        setNextCursor(res.data.data.nextCursor);
      })
      .catch(() => {
        setItems([]);
        setHasMore(false);
        setNextCursor(null);
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!customerId || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await customerService.getTimeline(customerId, { before: nextCursor });
      setItems((prev) => [...prev, ...res.data.data.items]);
      setHasMore(res.data.data.hasMore);
      setNextCursor(res.data.data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [customerId, nextCursor]);

  const logActivity = useCallback(
    async (type, note) => {
      const res = await customerService.logActivity(customerId, { type, note });
      setItems((prev) => [res.data.data, ...prev]);
      return res.data.data;
    },
    [customerId]
  );

  return { items, loading, loadingMore, hasMore, loadMore, logActivity, refresh };
}
