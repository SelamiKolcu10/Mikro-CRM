/**
 * Müşteri birleşik timeline'ının tek kaynak enum'ları — hem model şeması hem
 * validators hem frontend (frontend/src/config/customerEvents.js kopyası) bu
 * dosyadan okur (bkz. config/leads.js aynı deseni).
 */

// Temsilcinin ELLE eklediği etkileşim türleri (actor zorunlu — bkz. spec §3.2).
const MANUAL_ACTIVITY_TYPES = ['note', 'call', 'meeting', 'email'];

// Sistem tarafından yazılan müşteri yaşam döngüsü olayları (actor null).
const SYSTEM_ACTIONS = ['created', 'plan_changed'];

// CustomerEvent.action enum'unun tamamı.
const CUSTOMER_EVENT_ACTIONS = [...MANUAL_ACTIVITY_TYPES, ...SYSTEM_ACTIONS];

module.exports = { MANUAL_ACTIVITY_TYPES, SYSTEM_ACTIONS, CUSTOMER_EVENT_ACTIONS };
