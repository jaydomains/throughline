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
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const [inbox, setInbox] = useState<DriftInboxResult>(EMPTY);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setInbox(EMPTY);
      setError(null);
      return;
    }
    try {
      setInbox(await api.getDriftInbox(projectId));
      setError(null);
    } catch (e: unknown) {
      // Surface the error instead of silently collapsing the inbox counter to zero
      // (SF6 — a failed fetch previously read as "inbox empty").
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { inbox, error, refresh };
}
