// Phase 18 Slice 4 — shared helpers for the communication-model graph views.
// Extracted out of `CommunicationGraphCanvas.tsx` / `ModulePanel.tsx` so the
// edge-identity scheme stays single-sourced (Gitar PR #31 Slice 4 finding 1).

import type { GraphEdge, Item } from '@throughline/shared';

// Stable identity for a derived edge. Endpoints come from `deriveCommunicationGraph`
// already lexicographically sorted, so the same (edge_type, pair) always renders
// the same id across runs.
export function edgeId(e: GraphEdge): string {
  return `${e.edge_type}:${e.endpoints[0]}->${e.endpoints[1]}`;
}

// Coupled-freshness key (T-D50 render property). The communication-model
// graph synthesises modules from items' `primary_unit_refs` and counts them
// per ref, so re-deriving the graph is necessary whenever the union of
// (ref → item_count) changes. Returning a deterministic string lets a
// `useEffect` dep-array shallow-compare detect that. Item title/status/
// description edits are excluded — they don't move modules or change counts,
// so they don't change the key, so no refetch.
export function computeCommItemsKey(items: readonly Item[]): string {
  const counts = new Map<string, number>();
  for (const i of items) {
    for (const ref of i.methodology_context.primary_unit_refs) {
      counts.set(ref, (counts.get(ref) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
}
