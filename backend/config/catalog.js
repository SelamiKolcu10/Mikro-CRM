/**
 * Ürün Kataloğu sabitleri — tek kaynak (bkz. config/deals.js deseni).
 * Hem model şeması, hem validators, hem frontend config buradan okur.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md §1.1
 */
const PRODUCT_UNITS = ['piece', 'hour', 'month', 'project', 'license'];
const DEFAULT_TAX_RATE = 20; // KDV %20

// Para birimi tek kaynak: deals'tan re-export (drift olmasın).
const { DEAL_CURRENCIES } = require('./deals');

module.exports = { PRODUCT_UNITS, DEFAULT_TAX_RATE, CATALOG_CURRENCIES: DEAL_CURRENCIES };
