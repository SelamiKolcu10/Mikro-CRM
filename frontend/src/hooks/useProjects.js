import { useState, useEffect, useCallback } from 'react';
import projectService from '../services/projectService';
import taskService from '../services/taskService';

/**
 * Tüm proje veri/iş mantığı burada yaşar — Projects.jsx ve alt bileşenleri
 * (ProjectCard/ProjectDrawer/ProjectFormModal) sadece görüntüleme yapar,
 * hiçbiri doğrudan projectService'e dokunmaz (mobil port hedefi, bkz.
 * hooks/useTasks.js aynı desen).
 */
export function useProjects({ enabled = true } = {}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectService.getAll();
      setProjects(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Projeler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  // `enabled: false` — çağıran canManageProjects değilse (ör. CreateTaskModal
  // her açılışta mount olur ama proje seçici sadece dev-lead/super_admin'e
  // görünür) /api/projects'e hiç istek atma; o kullanıcı zaten 403 alır.
  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  const createProject = useCallback(async (payload) => {
    const res = await projectService.create(payload);
    setProjects((prev) => [res.data.data, ...prev]);
    return res.data.data;
  }, []);

  const updateProject = useCallback(async (id, payload) => {
    const res = await projectService.update(id, payload);
    setProjects((prev) => prev.map((p) => (p._id === id ? res.data.data : p)));
    return res.data.data;
  }, []);

  const deleteProject = useCallback(async (id) => {
    await projectService.remove(id);
    setProjects((prev) => prev.filter((p) => p._id !== id));
  }, []);

  return { projects, loading, error, refresh, createProject, updateProject, deleteProject };
}

/**
 * canManageProjects olmayan bir ekip üyesinin sadece KENDİ takımında olduğu
 * projeleri görebilmesi için — tam listeye (useProjects/GET /) erişimi yok
 * (bkz. routes/projectRoutes.js: /mine requireProjectManager'dan muaf).
 */
export function useMyProjects({ enabled = true } = {}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectService.getMine();
      setProjects(res.data.data);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  return { projects, loading, refresh };
}

/**
 * Drawer açılınca lazy fetch — kapalıyken hiç istek atmaz. Bu, TaskBoard'un
 * gösterdiğiyle AYNI Task koleksiyonudur (projectId'ye göre filtrelenmiş) —
 * `updateStatus` da gerçek `PATCH /api/tasks/:id/status`'u çağırır, ayrı bir
 * "proje görevi" kavramı yok (bkz. design doc: bunlar bağımsız değil).
 */
export function useProjectTasks(projectId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    setLoading(true);
    projectService
      .getTasks(projectId)
      .then((res) => setTasks(res.data.data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const updateStatus = useCallback(async (id, status) => {
    const res = await taskService.updateStatus(id, status);
    setTasks((prev) => prev.map((t) => (t._id === id ? res.data.data : t)));
    return res.data.data;
  }, []);

  // "+ Görev Ekle" (ProjectDrawer) — gerçek `POST /api/tasks`'i çağırır,
  // sadece projectId önceden bu projeye kilitlenmiş gelir (bkz.
  // CreateTaskModal'ın `project` prop'lu modu).
  const createTask = useCallback(async (payload) => {
    const res = await taskService.create(payload);
    setTasks((prev) => [res.data.data, ...prev]);
    return res.data.data;
  }, []);

  return { tasks, loading, updateStatus, createTask };
}
