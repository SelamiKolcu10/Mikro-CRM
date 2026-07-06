/**
 * Calculate priority based on customer's Monthly Recurring Revenue (MRR).
 * This is the core business logic of the CRM — higher MRR = higher priority.
 *
 * @param {number} mrr - Customer's monthly recurring revenue in dollars
 * @returns {string} Priority level: 'critical' | 'high' | 'medium' | 'low'
 */
const calculatePriority = (mrr) => {
  if (mrr >= 200) return 'critical';
  if (mrr >= 100) return 'high';
  if (mrr > 0) return 'medium';
  return 'low';
};

/**
 * Get a numeric weight for priority level (for sorting fallback).
 *
 * @param {string} priority - Priority string
 * @returns {number} Weight value
 */
const getPriorityWeight = (priority) => {
  const weights = { critical: 4, high: 3, medium: 2, low: 1 };
  return weights[priority] || 0;
};

module.exports = { calculatePriority, getPriorityWeight };
