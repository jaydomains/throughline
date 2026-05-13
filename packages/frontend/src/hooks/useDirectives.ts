import { useCallback, useEffect, useState } from 'react';
import type { Directive, DirectiveKind, DirectiveParentType } from '@throughline/shared';
import { api } from '../api.js';

// Phase 6b — directives loader hook. Returns the project's directives plus an indexed
// map keyed by `${parent_type}:${parent_id}` so consumers can ask "what directives apply
// to this item?" in O(1). Refresh is exposed so write paths (modal save, delete) can
// re-pull without remounting.

export interface DirectivesData {
  directives: Directive[];
  byParent: Map<string, Directive[]>;
  countByKind: Record<DirectiveKind, number>;
  refresh: () => Promise<void>;
}

function parentKey(parentType: DirectiveParentType, parentId: string): string {
  return `${parentType}:${parentId}`;
}

export function useDirectives(projectId: string | null): DirectivesData {
  const [directives, setDirectives] = useState<Directive[]>([]);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setDirectives([]);
      return;
    }
    try {
      const r = await api.listDirectives(projectId);
      setDirectives(r.directives);
    } catch {
      setDirectives([]);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byParent = new Map<string, Directive[]>();
  const countByKind: Record<DirectiveKind, number> = { pin: 0, reminder: 0, include_prompt: 0 };
  for (const d of directives) {
    const key = parentKey(d.parent_type, d.parent_id);
    const arr = byParent.get(key) ?? [];
    arr.push(d);
    byParent.set(key, arr);
    countByKind[d.kind] += 1;
  }
  return { directives, byParent, countByKind, refresh };
}

export function directivesFor(
  byParent: Map<string, Directive[]>,
  parentType: DirectiveParentType,
  parentId: string,
): Directive[] {
  return byParent.get(parentKey(parentType, parentId)) ?? [];
}

export function isPinned(directives: Directive[]): boolean {
  return directives.some((d) => d.kind === 'pin');
}
