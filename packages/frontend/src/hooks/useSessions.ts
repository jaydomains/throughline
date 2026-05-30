import { useMemo } from 'react';
import type { Session } from '@throughline/shared';
import { api } from '../api.js';
import { useResource } from './useResource.js';

const NO_SESSIONS: Session[] = [];

export function useSessions(projectId: string | null) {
  const fetcher = useMemo<(() => Promise<Session[]>) | null>(
    () => (projectId ? () => api.listSessions(projectId).then((r) => r.sessions) : null),
    [projectId],
  );

  const { data, loading, error, refresh } = useResource(fetcher, NO_SESSIONS);
  return { sessions: data, loading, error, refresh };
}
