import { useState, useEffect, useCallback } from 'react';
import taskService from '../services/taskService';

/**
 * Bir görevin yorumları — web'deki hooks/useTaskComments.js'in kopyası.
 * Ekran presentational kalır, veri/POST burada yaşar.
 */
export function useTaskComments(taskId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!taskId) {
      setComments([]);
      return;
    }
    setLoading(true);
    taskService
      .getComments(taskId)
      .then((res) => setComments(res.data.data))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addComment = useCallback(
    async (text) => {
      const res = await taskService.addComment(taskId, text);
      setComments((prev) => [...prev, res.data.data]);
      return res.data.data;
    },
    [taskId]
  );

  return { comments, loading, addComment };
}
