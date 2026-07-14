const LOCALE_BY_LANG = { tr: 'tr-TR', en: 'en-US' };

function localeFor(lang) {
  return LOCALE_BY_LANG[lang] || LOCALE_BY_LANG.tr;
}

export function formatDate(date, lang) {
  return new Date(date).toLocaleDateString(localeFor(lang));
}

export function formatDateTime(date, lang) {
  return new Date(date).toLocaleString(localeFor(lang));
}

export function formatTime(date, lang) {
  return new Date(date).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' });
}
