import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@throughline/shared';
import { api } from '../api.js';

export function useSessions(projectId: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!projectId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .listSessions(projectId)
      .then((r) => setSessions(r.sessions))
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh };
}
