import { useMemo } from 'react';
import type { ItemPolicy } from '@throughline/shared';
import { api } from '../api.js';
import { useResource } from './useResource.js';

export function useItemPolicy(projectId: string | null) {
  const fetcher = useMemo<(() => Promise<ItemPolicy>) | null>(
    () => (projectId ? () => api.getPolicy(projectId).then((r) => r.policy) : null),
    [projectId],
  );

  const { data, loading, error } = useResource<ItemPolicy | null>(fetcher, null);
  return { policy: data, loading, error };
}
