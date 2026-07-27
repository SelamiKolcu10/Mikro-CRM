import { useState, useEffect, useCallback } from 'react';
import taskService from '../services/taskService';

/**
 * Görev veri/iş mantığı — web'deki hooks/useTasks.js'in mobil kopyası (o hook
 * zaten "ileride aynen React Native'e taşınsın" diye DOM-bağımsız yazılmıştı).
 * Ekranlar taskService'e doğrudan dokunmaz.
 */
export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await taskService.getAll();
      setTasks(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Görevler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTask = useCallback(async (payload) => {
    const res = await taskService.create(payload);
    setTasks((prev) => [res.data.data, ...prev]);
    return res.data.data;
  }, []);

  const updateTaskStatus = useCallback(async (id, status) => {
    const res = await taskService.updateStatus(id, status);
    setTasks((prev) => prev.map((t) => (t._id === id ? res.data.data : t)));
    return res.data.data;
  }, []);

  /**
   * Deadline taşıma — iyimser: görev anında yeni güne oturur, istek başarısız
   * olursa (403/404/409/ağ) eski tarihe geri alınır ve hata çağırana fırlatılır.
   * `__v` snapshot'ı 409 çakışma kontrolü için backend'e gider.
   */
  const updateTaskDeadline = useCallback(async (id, deadline) => {
    let snapshot;
    setTasks((prev) => {
      snapshot = prev.find((t) => t._id === id);
      return prev.map((t) => (t._id === id ? { ...t, deadline } : t));
    });
    try {
      const res = await taskService.updateDeadline(id, deadline, snapshot?.__v);
      setTasks((prev) => prev.map((t) => (t._id === id ? res.data.data : t)));
      return res.data.data;
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t._id === id ? snapshot : t)));
      throw err;
    }
  }, []);

  const getAssignableUsers = useCallback(async (department) => {
    const res = await taskService.getAssignableUsers(department);
    return res.data.data;
  }, []);

  const getActivityHeatmap = useCallback(async (params) => {
    const res = await taskService.getActivityHeatmap(params);
    return res.data.data;
  }, []);

  return {
    tasks,
    loading,
    error,
    refresh,
    createTask,
    updateTaskStatus,
    updateTaskDeadline,
    getAssignableUsers,
    getActivityHeatmap,
  };
}
