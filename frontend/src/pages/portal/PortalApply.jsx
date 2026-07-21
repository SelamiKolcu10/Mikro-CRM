import { useMemo } from 'react';
import { HiOutlineCheckCircle } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useLeadForm } from '../../hooks/useLeadForm';
import LeadRequestForm from '../../components/leads/LeadRequestForm';

/**
 * Portal Başvuru sayfası — giriş yapmış müşterinin satış-başvurusu (Lead)
 * göndermesi için. Public /talep ile AYNI formu (LeadRequestForm) ve aynı
 * hook'u (useLeadForm) kullanır, sadece kabuk farklı (PortalLayout içinde bir
 * kart). Gönderilen Lead admin'deki Formlar paneline düşer; e-posta eşleşince
 * müşteriye otomatik bağlanır (bkz. leadController.createLead §8). Portalın
 * mevcut "Taleplerim" destek-talebi sistemine dokunulmaz — bu ayrı bir eksen.
 */
const PortalApply = () => {
  const { t } = useLanguage();
  const { customerUser } = useAuth();

  // Stabil prefill — giriş yapmış müşterinin adı/e-postası hazır gelsin
  // (useLeadForm bunu INITIAL_FORM üstüne bindirir; useMemo ile referans sabit).
  const prefill = useMemo(
    () => ({
      name: customerUser?.customer?.name || '',
      email: customerUser?.customer?.email || '',
    }),
    [customerUser]
  );

  const { form, setField, setType, handleSubmit, reset, submitting, submitted, error } = useLeadForm(prefill);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('leads.portalApply.title')}</h1>
          <p>{t('leads.portalApply.subtitle')}</p>
        </div>
      </div>

      {submitted ? (
        <div className="chart-card portal-apply-success">
          <div className="lead-form-success-icon-ring">
            <HiOutlineCheckCircle className="lead-form-success-icon" />
          </div>
          <h2>{t('leads.form.successTitle')}</h2>
          <p>{t('leads.form.successBody')}</p>
          <button type="button" className="btn btn-secondary" onClick={reset}>
            {t('leads.form.sendAnother')}
          </button>
        </div>
      ) : (
        <div className="chart-card portal-apply-card">
          <LeadRequestForm
            form={form}
            setField={setField}
            setType={setType}
            onSubmit={handleSubmit}
            submitting={submitting}
            error={error}
          />
        </div>
      )}
    </>
  );
};

export default PortalApply;
