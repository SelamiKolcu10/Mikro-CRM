import { useState, useEffect, useCallback } from 'react';
import taskService from '../services/taskService';

/**
 * Yorum verisi/POST'u burada yaşar — TaskDetailModal presentational kalır
 * (mevcut canAct/canApprove desenine ek: TaskBoard bu hook'u bağlayıp
 * comments/addComment'i props olarak geçer).
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
