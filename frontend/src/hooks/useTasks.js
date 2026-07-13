import { useState, useEffect, useCallback } from 'react';
import taskService from '../services/taskService';

/**
 * Tüm task veri/iş mantığı burada yaşar — Tasks.jsx ve alt bileşenleri
 * (TaskBoard/TaskColumn/TaskCard) sadece görüntüleme + sürükle-bırak
 * yapar, hiçbiri doğrudan taskService'e dokunmaz. Bu ayrım, mobil
 * (React Native) porta ileride bu hook'un aynen taşınabilmesi içindir.
 */
export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
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

  const getAssignableUsers = useCallback(async (department) => {
    const res = await taskService.getAssignableUsers(department);
    return res.data.data;
  }, []);

  const getActivityHeatmap = useCallback(async (params) => {
    const res = await taskService.getActivityHeatmap(params);
    return res.data.data;
  }, []);

  return { tasks, loading, error, createTask, updateTaskStatus, refresh, getAssignableUsers, getActivityHeatmap };
}

/**
 * Saf filtre fonksiyonu — DOM'dan bağımsız, mobil port hedefiyle tutarlı.
 * assignedTo hem populate edilmiş ({_id,...}) hem ham ObjectId string
 * olabilir (bkz. frontend/src/utils/taskScope.js'in aynı deseni).
 */
export function applyTaskFilters(tasks, filters, currentUserId) {
  return tasks.filter((task) => {
    const assigneeId = task.assignedTo?._id || task.assignedTo;
    if (filters.onlyMine && assigneeId !== currentUserId) return false;
    if (filters.department && task.department !== filters.department) return false;
    if (filters.assigneeId && assigneeId !== filters.assigneeId) return false;
    return true;
  });
}
