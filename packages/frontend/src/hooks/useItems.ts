import { useCallback, useEffect, useState } from 'react';
import type { Item } from '@throughline/shared';
import { api } from '../api.js';

export interface UseItemsOpts {
  projectId: string | null;
  sessionId?: string;
  parentId?: string | null;
}

export function useItems({ projectId, sessionId, parentId }: UseItemsOpts) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const opts: { session_id?: string; parent_id?: string | null } = {};
    if (sessionId) opts.session_id = sessionId;
    if (parentId !== undefined) opts.parent_id = parentId;
    api
      .listItems(projectId, opts)
      .then((r) => setItems(r.items))
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [projectId, sessionId, parentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
