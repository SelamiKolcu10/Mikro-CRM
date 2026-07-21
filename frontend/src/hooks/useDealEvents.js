import { useState, useEffect, useCallback } from 'react';
import dealService from '../services/dealService';

/**
 * Bir fırsatın zaman çizelgesi (DealEvent) — hooks/useLeadEvents.js aynası.
 * DealDetailDrawer bunu dealId prop'undan bağlar.
 */
export function useDealEvents(dealId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!dealId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    dealService
      .getEvents(dealId)
      .then((res) => setEvents(res.data.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [dealId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addNote = useCallback(
    async (note) => {
      const res = await dealService.addNote(dealId, note);
      setEvents((prev) => [res.data.data, ...prev]);
      return res.data.data;
    },
    [dealId]
  );

  return { events, loading, addNote, refresh };
}
