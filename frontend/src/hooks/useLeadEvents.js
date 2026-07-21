import { useState, useEffect, useCallback } from 'react';
import leadService from '../services/leadService';

/**
 * Bir lead'in zaman çizelgesi (LeadEvent) — hooks/useTaskComments.js ile
 * aynı desen. LeadDetailDrawer bunu leadId prop'undan bağlar.
 */
export function useLeadEvents(leadId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!leadId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    leadService
      .getEvents(leadId)
      .then((res) => setEvents(res.data.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addNote = useCallback(
    async (note) => {
      const res = await leadService.addNote(leadId, note);
      setEvents((prev) => [res.data.data, ...prev]);
      return res.data.data;
    },
    [leadId]
  );

  return { events, loading, addNote, refresh };
}
