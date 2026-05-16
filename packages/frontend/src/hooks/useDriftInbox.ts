import { useCallback, useEffect, useState } from 'react';
import type { DriftInboxResult } from '@throughline/shared';
import { api } from '../api.js';

// Phase 10 (C-D16; CHECKLIST §Phase 10) — drift-inbox loader. The header counter spans
// BOTH streams (code tier-4 + discipline). Refresh is exposed so per-signal actions
// (dismiss / reopen / re-verify) can re-pull without remounting.

const EMPTY: DriftInboxResult = {
  signals: [],
  total_count: 0,
  code_count: 0,
  discipline_count: 0,
};

export function useDriftInbox(projectId: string | null): {
  inbox: DriftInboxResult;
  refresh: () => Promise<void>;
} {
  const [inbox, setInbox] = useState<DriftInboxResult>(EMPTY);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setInbox(EMPTY);
      return;
    }
    try {
      setInbox(await api.getDriftInbox(projectId));
    } catch {
      setInbox(EMPTY);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { inbox, refresh };
}
