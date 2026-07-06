import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import trLang from '../i18n/tr.json';
import enLang from '../i18n/en.json';

const languages = { tr: trLang, en: enLang };

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('micro-crm-lang') || 'tr';
  });

  useEffect(() => {
    localStorage.setItem('micro-crm-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  /**
   * Translation function — access nested keys with dot notation.
   * Example: t('dashboard.title') → "Kontrol Paneli"
   */
  const t = useCallback(
    (key) => {
      const keys = key.split('.');
      let value = languages[lang];
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return key; // Fallback: return key itself if not found
        }
      }
      return value;
    },
    [lang]
  );

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'tr' ? 'en' : 'tr'));
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
