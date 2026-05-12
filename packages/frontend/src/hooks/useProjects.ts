import { useCallback, useEffect, useState } from 'react';
import type { Project } from '@throughline/shared';
import { api } from '../api.js';

export interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useProjects(): ProjectsState {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .listProjects()
      .then((r) => setProjects(r.projects))
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, error, refresh };
}
