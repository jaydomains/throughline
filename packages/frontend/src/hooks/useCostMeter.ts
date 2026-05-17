import { useEffect, useState } from 'react';
import type { CostSummary } from '@throughline/shared';
import { api } from '../api.js';

// Cost meter (T-D29). Polls the summary for the active project (global rollup when no
// project is active) so the header pill is live at all times. SSE pushes a 'cost' tick
// (CODE_SPEC §6) but a slow poll is the resilient floor; 30s keeps it cheap.
export function useCostMeter(
  activeProjectId: string | null,
  intervalMs = 30_000,
): { summary: CostSummary | null; refresh: () => void } {
  const [summary, setSummary] = useState<CostSummary | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      api
        .getCostSummary(
          activeProjectId ? { projectId: activeProjectId, scope: 'project' } : { scope: 'global' },
        )
        .then((s) => {
          if (alive) setSummary(s);
        })
        .catch(() => {});
    };
    tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [activeProjectId, intervalMs]);

  return {
    summary,
    refresh: () => {
      api
        .getCostSummary(
          activeProjectId ? { projectId: activeProjectId, scope: 'project' } : { scope: 'global' },
        )
        .then(setSummary)
        .catch(() => {});
    },
  };
}
