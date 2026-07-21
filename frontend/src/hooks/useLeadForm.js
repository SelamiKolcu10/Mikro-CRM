import { useState, useCallback } from 'react';
import leadService from '../services/leadService';

const INITIAL_FORM = {
  type: 'quote',
  name: '',
  email: '',
  phone: '',
  company: '',
  budgetRange: '',
  timeframe: '',
  message: '',
  kvkkConsent: false,
  // Honeypot — gerçek kullanıcı hiç görmez (CSS ile ekran dışına gizlenir),
  // bot'lar form alanlarını otomatik doldururken bunu da doldurur. Dolu
  // gelirse backend sessizce "başarılı" der ama hiçbir şey kaydetmez.
  website: '',
};

/**
 * Talep formunun state/iş mantığı — DOM'dan ayrık (mobil port hedefi,
 * bkz. hooks/useTasks.js'teki aynı gerekçe). Hem public /talep sayfası hem
 * portal Başvuru sayfası aynı hook'u + aynı LeadRequestForm bileşenini
 * kullanır. `prefill` (portal'da giriş yapmış müşterinin ad/e-posta'sı gibi)
 * INITIAL_FORM üstüne bindirilir — stabil bir obje olmalı (bkz. çağıranda
 * useMemo).
 */
export function useLeadForm(prefill) {
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, ...prefill }));
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setType = useCallback((type) => {
    // Tip değişince alakasız alanları temizle — 'quote' dışı bir tipte
    // bütçe/zaman formda görünmez, gönderilen payload'da da olmamalı.
    setForm((prev) => ({ ...prev, type, budgetRange: '', timeframe: '' }));
  }, []);

  const reset = useCallback(() => {
    setForm({ ...INITIAL_FORM, ...prefill });
    setSubmitted(false);
    setError(null);
  }, [prefill]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        type: form.type,
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        company: form.company || undefined,
        message: form.message,
        kvkkConsent: form.kvkkConsent,
        website: form.website,
        ...(form.type === 'quote' ? { budgetRange: form.budgetRange || undefined, timeframe: form.timeframe || undefined } : {}),
      };
      await leadService.submit(payload);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || null);
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  return { form, setField, setType, handleSubmit, reset, submitting, submitted, error };
}
