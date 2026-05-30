import { useMemo } from 'react';
import type { CostSummary } from '@throughline/shared';
import { api } from '../api.js';
import { usePolledResource } from './useResource.js';

// Cost meter (T-D29). Polls the summary for the active project (global rollup when no
// project is active) so the header pill is live at all times. SSE pushes a 'cost' tick
// (CODE_SPEC §6) but a slow poll is the resilient floor; 30s keeps it cheap.
//
// Built on usePolledResource (C-D24): the fetcher is memoised on activeProjectId so a
// held reference can't query with a stale project after a switch, and a failed poll now
// surfaces an `error` instead of vanishing into a silent `.catch(() => {})`.
export function useCostMeter(
  activeProjectId: string | null,
  intervalMs = 30_000,
): { summary: CostSummary | null; error: Error | null; refresh: () => void } {
  const fetcher = useMemo<() => Promise<CostSummary | null>>(
    () => () =>
      api.getCostSummary(
        activeProjectId ? { projectId: activeProjectId, scope: 'project' } : { scope: 'global' },
      ),
    [activeProjectId],
  );
  const { data, error, refresh } = usePolledResource<CostSummary | null>(fetcher, null, intervalMs);
  return { summary: data, error, refresh };
}
