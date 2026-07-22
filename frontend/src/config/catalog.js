/**
 * Frontend kopyası — backend/config/catalog.js ile senkron tutulmalı.
 * Board bileşenleri tek kaynak olarak buradan okur.
 */
export const PRODUCT_UNITS = ['piece', 'hour', 'month', 'project', 'license'];
export const DEFAULT_TAX_RATE = 20;
export const CATALOG_CURRENCIES = ['TRY', 'USD', 'EUR'];

export const UNIT_LABELS = {
  piece: 'catalog.unit.piece',
  hour: 'catalog.unit.hour',
  month: 'catalog.unit.month',
  project: 'catalog.unit.project',
  license: 'catalog.unit.license',
};

export const CURRENCY_SYMBOL = { TRY: '₺', USD: '$', EUR: '€' };
