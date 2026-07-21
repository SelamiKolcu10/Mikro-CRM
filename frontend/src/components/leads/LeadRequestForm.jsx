import { HiOutlineTag, HiOutlineLightBulb, HiOutlineQuestionMarkCircle } from 'react-icons/hi';
import { useLanguage } from '../../context/LanguageContext';
import { BUDGET_OPTIONS, TIMEFRAME_OPTIONS } from '../../config/leads';

const TYPE_OPTIONS = [
  { value: 'quote', icon: HiOutlineTag, labelKey: 'leads.form.types.quote' },
  { value: 'idea', icon: HiOutlineLightBulb, labelKey: 'leads.form.types.idea' },
  { value: 'question', icon: HiOutlineQuestionMarkCircle, labelKey: 'leads.form.types.question' },
];

/**
 * Talep formunun alanları — presentational, state'i dışarıdan (useLeadForm)
 * alır. İki yerde kullanılır: public /talep sayfası (LeadForm.jsx) ve portal
 * Başvuru sayfası (PortalApply.jsx) — form JSX'i tek yerde, tekrar yok.
 */
const LeadRequestForm = ({ form, setField, setType, onSubmit, submitting, error }) => {
  const { t } = useLanguage();

  return (
    <form onSubmit={onSubmit}>
      <div className="form-group">
        <label className="form-label">{t('leads.form.typeLabel')}</label>
        <div className="type-picker" role="radiogroup" aria-label={t('leads.form.typeLabel')}>
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = form.type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`type-option ${active ? 'active' : ''}`}
                onClick={() => setType(opt.value)}
              >
                <Icon />
                <span>{t(opt.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('leads.form.name')} <span className="lead-required-mark">*</span></label>
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder={t('leads.form.namePlaceholder')}
            minLength={2}
            maxLength={100}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('leads.form.email')} <span className="lead-required-mark">*</span></label>
          <input
            type="email"
            className="form-input"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder={t('leads.form.emailPlaceholder')}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('leads.form.company')}</label>
          <input
            className="form-input"
            value={form.company}
            onChange={(e) => setField('company', e.target.value)}
            placeholder={t('leads.form.optional')}
            maxLength={120}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('leads.form.phone')}</label>
          <input
            className="form-input"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder={t('leads.form.optional')}
            maxLength={30}
          />
        </div>
      </div>

      {form.type === 'quote' && (
        <div className="lead-form-conditional">
          <p className="lead-form-conditional-hint">{t('leads.form.quoteFieldsHint')}</p>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('leads.form.budgetRange')}</label>
              <select
                className="form-select"
                value={form.budgetRange}
                onChange={(e) => setField('budgetRange', e.target.value)}
              >
                <option value="">{t('leads.form.selectBudget')}</option>
                {BUDGET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('leads.form.timeframe')}</label>
              <select
                className="form-select"
                value={form.timeframe}
                onChange={(e) => setField('timeframe', e.target.value)}
              >
                <option value="">{t('leads.form.selectTimeframe')}</option>
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">{t('leads.form.message')} <span className="lead-required-mark">*</span></label>
        <textarea
          className="form-input"
          value={form.message}
          onChange={(e) => setField('message', e.target.value)}
          placeholder={t('leads.form.messagePlaceholder')}
          minLength={10}
          maxLength={4000}
          rows={4}
          required
        />
      </div>

      {/* Honeypot — gerçek kullanıcıya asla görünmez (bkz. useLeadForm.js). */}
      <div className="lead-honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => setField('website', e.target.value)}
        />
      </div>

      <div className="form-group lead-consent">
        <label className="lead-consent-label">
          <input
            type="checkbox"
            checked={form.kvkkConsent}
            onChange={(e) => setField('kvkkConsent', e.target.checked)}
            required
          />
          <span>{t('leads.form.consent')}</span>
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      <button type="submit" className="btn btn-primary lead-submit" disabled={submitting}>
        {submitting ? t('common.loading') : t('leads.form.submit')}
      </button>
    </form>
  );
};

export default LeadRequestForm;
