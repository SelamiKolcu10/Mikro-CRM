import { HiOutlineCheckCircle } from 'react-icons/hi';
import { useLanguage } from '../context/LanguageContext';
import { useLeadForm } from '../hooks/useLeadForm';
import LeadRequestForm from '../components/leads/LeadRequestForm';

/**
 * Public talep formu — auth'suz, Layout'un (sidebar/navbar) dışında, kendi
 * sayfa kabuğunu (marka + hero başlık + merkezi kart) taşır (bkz. App.jsx:
 * /login ile aynı seviyede mount edilir). Form alanları LeadRequestForm'da,
 * bu sayfa sadece kabuğu ve başarı ekranını yönetir. Portal Başvuru sayfası
 * (PortalApply.jsx) aynı formu farklı bir kabukta gösterir.
 */
const LeadForm = () => {
  const { t } = useLanguage();
  const { form, setField, setType, handleSubmit, reset, submitting, submitted, error } = useLeadForm();

  if (submitted) {
    return (
      <div className="lead-form-page">
        <div className="lead-form-card lead-form-success">
          <div className="lead-form-success-icon-ring">
            <HiOutlineCheckCircle className="lead-form-success-icon" />
          </div>
          <h2>{t('leads.form.successTitle')}</h2>
          <p>{t('leads.form.successBody')}</p>
          <button type="button" className="btn btn-secondary" onClick={reset}>
            {t('leads.form.sendAnother')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lead-form-page">
      <div className="lead-form-card">
        <div className="login-logo lead-form-logo">
          <div className="logo-icon">μ</div>
          <h1>Micro CRM</h1>
        </div>
        <h2 className="lead-form-title">{t('leads.form.title')}</h2>
        <p className="lead-form-subtitle">{t('leads.form.subtitle')}</p>

        <LeadRequestForm
          form={form}
          setField={setField}
          setType={setType}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
        />
      </div>
    </div>
  );
};

export default LeadForm;
