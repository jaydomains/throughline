import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@throughline/shared';
import { api } from '../api.js';

export function useSessions(projectId: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api.listSessions(projectId);
      setSessions(r.sessions);
    } catch (e: unknown) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh };
}
