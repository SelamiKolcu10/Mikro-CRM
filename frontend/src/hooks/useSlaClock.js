import { useEffect, useState } from 'react';

/**
 * One shared 30s tick, consumed by every row's SLA computation in
 * ChatDashboard — a single timer instead of one setInterval per row. The
 * returned value has no meaning of its own; it just changes every 30s to
 * trigger a re-render of components that call getSlaState(conversation,
 * Date.now()) on each render.
 */
export function useSlaClock() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return tick;
}
