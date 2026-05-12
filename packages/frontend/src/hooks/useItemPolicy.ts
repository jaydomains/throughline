import { useEffect, useState } from 'react';
import type { ItemPolicy } from '@throughline/shared';
import { api } from '../api.js';

export function useItemPolicy(projectId: string | null) {
  const [policy, setPolicy] = useState<ItemPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) {
      setPolicy(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .getPolicy(projectId)
      .then((r) => {
        if (alive) setPolicy(r.policy);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  return { policy, loading, error };
}
