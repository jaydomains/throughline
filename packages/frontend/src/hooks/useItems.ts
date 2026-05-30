import { useMemo } from 'react';
import type { Item } from '@throughline/shared';
import { api } from '../api.js';
import { useResource } from './useResource.js';

export interface UseItemsOpts {
  projectId: string | null;
  sessionId?: string;
  parentId?: string | null;
}

const NO_ITEMS: Item[] = [];

export function useItems({ projectId, sessionId, parentId }: UseItemsOpts) {
  const fetcher = useMemo<(() => Promise<Item[]>) | null>(() => {
    if (!projectId) return null;
    const opts: { session_id?: string; parent_id?: string | null } = {};
    if (sessionId) opts.session_id = sessionId;
    if (parentId !== undefined) opts.parent_id = parentId;
    return () => api.listItems(projectId, opts).then((r) => r.items);
  }, [projectId, sessionId, parentId]);

  const { data, loading, error, refresh } = useResource(fetcher, NO_ITEMS);
  return { items: data, loading, error, refresh };
}
