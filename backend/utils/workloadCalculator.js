const PRIORITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

const LOW_LOAD_MAX = 3;
const OPTIMAL_LOAD_MAX = 6;

// No-deadline tasks carry no time pressure in this model — treated as a flat
// 30-day horizon (D = 30) rather than left undefined, so they still
// contribute a small, non-zero weight instead of crashing/NaN-ing the sum.
const NO_DEADLINE_HORIZON_DAYS = 30;
const MIN_DAYS_FLOOR = 0.5;

/**
 * W(t) = P(t) * (1 / max(D(t), 0.5))
 * P(t): priority weight. D(t): days remaining until deadline, floored at 0.5
 * to guard overdue/due-today tasks against division blow-up.
 */
function taskWeight(task, now = Date.now()) {
  const days = task.deadline
    ? (new Date(task.deadline).getTime() - now) / (1000 * 60 * 60 * 24)
    : NO_DEADLINE_HORIZON_DAYS;
  return PRIORITY_WEIGHT[task.priority] * (1 / Math.max(days, MIN_DAYS_FLOOR));
}

function classifyLoad(score) {
  if (score < LOW_LOAD_MAX) return 'LOW_LOAD';
  if (score <= OPTIMAL_LOAD_MAX) return 'OPTIMAL_LOAD';
  return 'OVERLOADED';
}

/** @param {object[]} tasks - already filtered to this user's active (non-done) tasks */
function computeWorkload(tasks, now = Date.now()) {
  const workloadScore = tasks.reduce((sum, task) => sum + taskWeight(task, now), 0);
  return {
    activeTaskCount: tasks.length,
    workloadScore,
    loadStatus: classifyLoad(workloadScore),
  };
}

module.exports = { PRIORITY_WEIGHT, taskWeight, classifyLoad, computeWorkload };
