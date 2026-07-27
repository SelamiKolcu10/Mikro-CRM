// Ürün Kataloğu sabitleri — backend/config/catalog.js ile senkron tutulmalı
// (web'deki frontend/src/config/catalog.js ile aynı rol). Mobilde i18n katmanı
// yok, o yüzden etiketler doğrudan Türkçe.
export const PRODUCT_UNITS = ['piece', 'hour', 'month', 'project', 'license'];
export const CATALOG_CURRENCIES = ['TRY', 'USD', 'EUR'];
export const DEFAULT_TAX_RATE = 20; // KDV %20

export const UNIT_LABEL = {
  piece: 'Adet',
  hour: 'Saat',
  month: 'Ay',
  project: 'Proje',
  license: 'Lisans',
};

// SelectField'in beklediği { value, label } biçimi.
export const UNIT_OPTIONS = PRODUCT_UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u] }));
export const CURRENCY_OPTIONS = CATALOG_CURRENCIES.map((c) => ({ value: c, label: c }));

// Katalogda yazma yetkisi — backend config/permissions.js `catalog.write` ile
// aynı: accountant yalnızca görüntüler.
export const CATALOG_WRITE_ROLES = ['super_admin', 'staff'];
export const canWriteCatalog = (role) => CATALOG_WRITE_ROLES.includes(role);
