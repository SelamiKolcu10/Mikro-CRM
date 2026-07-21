/**
 * Frontend kopyası — backend/config/customerEvents.js ile senkron tutulmalı.
 * `MANUAL_ACTIVITY_TYPES` "aktivite logla" formundaki tür seçenekleridir.
 */
export const MANUAL_ACTIVITY_TYPES = ['note', 'call', 'meeting', 'email'];

export const SYSTEM_ACTIONS = ['created', 'plan_changed'];

export const CUSTOMER_EVENT_ACTIONS = [...MANUAL_ACTIVITY_TYPES, ...SYSTEM_ACTIONS];
