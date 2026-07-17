import { ROLE_LABELS, DEPARTMENT_LABELS } from '../config/permissions';

export const ACTION_BADGE_CLASS = {
  create: 'badge-resolved',
  update: 'badge-open',
  delete: 'badge-bug',
};

const COLLECTION_LABEL_KEYS = {
  User: 'auditLog.collections.user',
  Customer: 'auditLog.collections.customer',
  CustomerUser: 'auditLog.collections.customerUser',
  Feedback: 'auditLog.collections.feedback',
  PermissionOverride: 'auditLog.collections.permissionOverride',
  System: 'auditLog.collections.system',
};

const FIELD_LABEL_KEYS = {
  name: 'auditLog.fields.name',
  email: 'auditLog.fields.email',
  company: 'auditLog.fields.company',
  plan: 'auditLog.fields.plan',
  mrr: 'auditLog.fields.mrr',
  source: 'auditLog.fields.source',
  notes: 'auditLog.fields.notes',
  role: 'auditLog.fields.role',
  status: 'auditLog.fields.status',
  department: 'auditLog.fields.department',
  isDepartmentLead: 'auditLog.fields.isDepartmentLead',
  password: 'auditLog.fields.password',
  mustChangePassword: 'auditLog.fields.mustChangePassword',
  active: 'auditLog.fields.active',
  title: 'auditLog.fields.title',
  description: 'auditLog.fields.description',
  type: 'auditLog.fields.type',
  assignedTo: 'auditLog.fields.assignedTo',
};

// Internal/derived fields that show up in a create/delete snapshot but mean
// nothing to a human reader — filtered out of the snapshot view.
export const SNAPSHOT_HIDDEN_KEYS = new Set(['_id', '__v', 'password', 'createdAt', 'updatedAt']);

export const fieldLabel = (field, t) => {
  const key = FIELD_LABEL_KEYS[field];
  return key ? t(key) : field;
};

export const collectionLabel = (collectionName, t) => {
  const key = COLLECTION_LABEL_KEYS[collectionName];
  return key ? t(key) : collectionName;
};

// Local-part of the actor's email, capitalized — the audit trail only
// denormalizes email (see backend/models/AuditLog.js), not a display name.
export const actorDisplayName = (email, t) => {
  if (!email) return t('auditLog.actorSystem');
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
};

export const truncate = (str, max = 80) => (str.length > max ? `${str.slice(0, max)}…` : str);

/** Renders a single field's value in a human-readable form for the given collection. */
export function formatFieldValue(collectionName, field, value, t) {
  if (value === undefined || value === null || value === '') return t('auditLog.valueEmpty');
  if (field === 'password') return t('auditLog.valueMasked');
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');

  if (field === 'role') return ROLE_LABELS[value] ? t(ROLE_LABELS[value]) : value;
  if (field === 'department') return DEPARTMENT_LABELS[value] ? t(DEPARTMENT_LABELS[value]) : value;
  if (field === 'plan') return t(`customers.plans.${value}`);
  if (field === 'source') return t(`customers.sources.${value}`);
  if (field === 'type' && collectionName === 'Feedback') return t(`feedbacks.types.${value}`);
  if (field === 'status') {
    if (collectionName === 'Feedback') return t(`feedbacks.statuses.${value}`);
    if (collectionName === 'User') return t(`users.statuses.${value}`);
    return String(value);
  }
  if (field === 'mrr') return `$${Number(value).toLocaleString()}`;
  // A raw ObjectId reference isn't meaningful on its own — show it the same
  // shorthand way the rest of the app does (see TaskHistory's `_id.slice(-6)`).
  if (field === 'assignedTo') return `#${String(value).slice(-6)}`;

  return typeof value === 'string' ? truncate(value) : String(value);
}

/** One-line, human-readable summary for the list row (replaces "N fields changed"). */
export function summarizeLog(log, t) {
  const actor = actorDisplayName(log.actorEmail, t);
  const collLabel = collectionLabel(log.collectionName, t);
  const identifier = log.snapshot?.name || log.snapshot?.title || log.snapshot?.email || log.snapshot?.note;
  const identifierSuffix = identifier ? ` "${truncate(String(identifier), 40)}"` : '';

  if (log.action === 'create') {
    return t('auditLog.summaryCreate').replace('{actor}', actor).replace('{collection}', collLabel).replace('{identifier}', identifierSuffix);
  }
  if (log.action === 'delete') {
    return t('auditLog.summaryDelete').replace('{actor}', actor).replace('{collection}', collLabel).replace('{identifier}', identifierSuffix);
  }

  const changes = log.changes || [];
  if (changes.length === 0) {
    return t('auditLog.summaryUpdateGeneric').replace('{actor}', actor).replace('{collection}', collLabel);
  }
  if (changes.length === 1) {
    const c = changes[0];
    return t('auditLog.summaryUpdateSingle')
      .replace('{actor}', actor)
      .replace('{field}', fieldLabel(c.field, t))
      .replace('{value}', formatFieldValue(log.collectionName, c.field, c.after, t));
  }
  const fieldNames = changes.map((c) => fieldLabel(c.field, t)).join(', ');
  return t('auditLog.summaryUpdateMultiple')
    .replace('{actor}', actor)
    .replace('{collection}', collLabel)
    .replace('{fields}', fieldNames);
}
