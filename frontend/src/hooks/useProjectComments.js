import { useState, useEffect, useCallback } from 'react';
import projectService from '../services/projectService';

/**
 * Proje tartışması — hooks/useTaskComments.js ile aynı desen. ProjectDrawer
 * presentational kalır, veri/POST burada yaşar (mobil port hedefi).
 */
export function useProjectComments(projectId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!projectId) {
      setComments([]);
      return;
    }
    setLoading(true);
    projectService
      .getComments(projectId)
      .then((res) => setComments(res.data.data))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addComment = useCallback(
    async (text) => {
      const res = await projectService.addComment(projectId, text);
      setComments((prev) => [...prev, res.data.data]);
      return res.data.data;
    },
    [projectId]
  );

  return { comments, loading, addComment };
}
