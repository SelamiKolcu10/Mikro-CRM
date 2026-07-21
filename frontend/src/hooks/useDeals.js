import { useState, useEffect, useCallback } from 'react';
import dealService from '../services/dealService';
import { DEAL_STAGE_PROBABILITY, OPEN_STAGES } from '../config/deals';

/**
 * Satış Pipeline veri/iş mantığı — hooks/useLeads.js ile aynı ayrım (Deals.jsx/
 * DealBoard DOM'a bağımlı, bu hook değil — mobil port hedefi). Stage değişimi
 * (sürükle-bırak) OPTIMISTIC: board kartı anında yeni kolona geçer ve olasılık/
 * ağırlıklı değer yerel olarak güncellenir; istek başarısız olursa (409 dahil)
 * eski hale döner ve hata yukarı fırlatılır ki UI "başkası güncelledi, yenile"
 * gösterip refresh çağırabilsin.
 */
export function useDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dealService.getAll();
      setDeals(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Fırsatlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateStage = useCallback(
    async (id, stage, lostReason) => {
      const previous = deals;
      const target = deals.find((d) => d._id === id);
      const expectedVersion = target?.__v;
      const probability = DEAL_STAGE_PROBABILITY[stage];

      // Optimistic: kartı yeni aşamaya taşı + türevleri yerel hesapla.
      setDeals((prev) =>
        prev.map((d) =>
          d._id === id
            ? {
                ...d,
                stage,
                probability,
                weightedValue: (d.value * probability) / 100,
                isOpen: OPEN_STAGES.includes(stage),
                lostReason: stage === 'lost' ? lostReason || '' : '',
              }
            : d
        )
      );

      try {
        const res = await dealService.updateStage(id, stage, expectedVersion, lostReason);
        setDeals((prev) => prev.map((d) => (d._id === id ? res.data.data : d)));
        return res.data.data;
      } catch (err) {
        setDeals(previous);
        throw err;
      }
    },
    [deals]
  );

  const updateDeal = useCallback(async (id, payload) => {
    const res = await dealService.update(id, payload);
    setDeals((prev) => prev.map((d) => (d._id === id ? res.data.data : d)));
    return res.data.data;
  }, []);

  const createDeal = useCallback(async (payload) => {
    const res = await dealService.create(payload);
    setDeals((prev) => [res.data.data, ...prev]);
    return res.data.data;
  }, []);

  return { deals, loading, error, refresh, updateStage, updateDeal, createDeal };
}
