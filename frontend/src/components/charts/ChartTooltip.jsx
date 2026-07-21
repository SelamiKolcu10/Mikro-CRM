import { useState, useCallback } from 'react';

/**
 * Ortak chart tooltip'i — imleci izleyen sabit konumlu küçük kart.
 * Kullanım: const { tooltip, show, hide } = useChartTooltip();
 * mark'ların onMouseMove/onMouseLeave'ine bağla, JSX'e {tooltip} koy.
 * (tasarım.md §5 — hover katmanı varsayılan.)
 */
export function useChartTooltip() {
  const [state, setState] = useState(null);

  const show = useCallback((e, content) => {
    setState({ x: e.clientX, y: e.clientY, content });
  }, []);

  const hide = useCallback(() => setState(null), []);

  const tooltip = state ? (
    <div className="viz-tooltip" style={{ left: state.x, top: state.y }}>
      {state.content}
    </div>
  ) : null;

  return { tooltip, show, hide };
}
