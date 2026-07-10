import { useState, useEffect, useCallback } from 'react';
import approvalService from '../services/approvalService';

/**
 * The requester-side half of the approval workflow — powers the "Admin
 * Onayı Bekliyor" badges/ghost-rows on list pages (Customers, Feedbacks).
 * DOM-agnostic (no JSX), matching this project's convention of keeping
 * data-fetching out of components (see hooks/useConversation.js).
 *
 * @param {string} resource - filter to one resource's pending requests
 *   ('customers' | 'feedbacks')
 */
export function useMyPendingApprovals(resource) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await approvalService.getMine({ status: 'pending' });
      setPending(resource ? res.data.data.filter((p) => p.resource === resource) : res.data.data);
    } catch {
      // Non-critical — badges simply won't show if this fails.
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pending, loading, refresh };
}
