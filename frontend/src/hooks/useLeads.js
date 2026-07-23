import { useState, useEffect, useCallback } from 'react';
import leadService from '../services/leadService';

/**
 * Formlar panelinin veri/iş mantığı — hooks/useTasks.js ile aynı ayrım
 * (Leads.jsx/LeadDetailDrawer DOM'a bağımlı, bu hook değil — mobil port
 * hedefi). Durum güncellemesi OPTIMISTIC: liste anında yeni durumu gösterir,
 * istek başarısız olursa eski duruma geri döner (bkz. handleUpdateStatus).
 */
export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leadService.getAll();
      setLeads(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Talepler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateStatus = useCallback(async (id, status) => {
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l._id === id ? { ...l, status } : l)));
    try {
      const res = await leadService.updateStatus(id, status);
      setLeads((prev) => prev.map((l) => (l._id === id ? res.data.data : l)));
      return res.data.data;
    } catch (err) {
      setLeads(previous);
      throw err;
    }
  }, [leads]);

  const assignTo = useCallback(async (id, assigneeId) => {
    const res = await leadService.assign(id, assigneeId);
    setLeads((prev) => prev.map((l) => (l._id === id ? res.data.data : l)));
    return res.data.data;
  }, []);

  return { leads, loading, error, refresh, updateStatus, assignTo };
}
