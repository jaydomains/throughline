// Pure, deterministic graph model + layout for the Graph view (SPEC §7.11).
//
// Nodes are items; edges are parent-child (from `parent_id`) and blocked-by
// (from `blockers[]` — item ids that block this one, T-D8). Cross-session and
// communication-model layers are deferred to a spec-author clarification
// (see DECISIONS.md working notes) and intentionally not modelled here.
//
// Everything is deterministic (stable sort, longest-path layering, no RNG, no
// animation) so the renderer is reproducible and jsdom-testable.

import type { Item } from '@throughline/shared';

export type EdgeKind = 'parent' | 'blocked';

export interface GraphNode {
  id: string;
  item: Item;
  layer: number;
  index: number; // stable position within its layer
}

export interface GraphEdge {
  id: string;
  from: string; // parent / blocker
  to: string; // child / blocked
  kind: EdgeKind;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layerCount: number;
  maxLayerSize: number;
}

export interface ChainAnalysis {
  // Items that block ≥1 other item and are themselves blocked by none in-set.
  rootBlockerIds: Set<string>;
  // Every node on a blocker dependency path descending from a root blocker
  // (root blockers included).
  chainNodeIds: Set<string>;
  // Edge ids (kind 'blocked' only) connecting two chain nodes.
  chainEdgeIds: Set<string>;
}

// Deterministic ordering: created_at then id. Used for layering tie-breaks and
// within-layer order so the layout never depends on input array order.
function stableSort(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function buildGraph(items: Item[]): GraphModel {
  const ordered = stableSort(items);
  const ids = new Set(ordered.map((i) => i.id));

  const edges: GraphEdge[] = [];
  for (const item of ordered) {
    if (item.parent_id && ids.has(item.parent_id)) {
      edges.push({
        id: `parent:${item.parent_id}->${item.id}`,
        from: item.parent_id,
        to: item.id,
        kind: 'parent',
      });
    }
    for (const blocker of item.blockers) {
      if (ids.has(blocker)) {
        edges.push({
          id: `blocked:${blocker}->${item.id}`,
          from: blocker,
          to: item.id,
          kind: 'blocked',
        });
      }
    }
  }

  // Longest-path layering: layer(to) >= layer(from) + 1. Cycle-guarded so a
  // self-referential blocker chain can't loop forever (defensive — the store
  // shouldn't produce cycles, but the renderer must never hang).
  const incoming = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    const arr = incoming.get(e.to) ?? [];
    arr.push(e);
    incoming.set(e.to, arr);
  }

  const layer = new Map<string, number>();
  const visiting = new Set<string>();
  function depth(id: string): number {
    const cached = layer.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    let d = 0;
    for (const e of incoming.get(id) ?? []) {
      d = Math.max(d, depth(e.from) + 1);
    }
    visiting.delete(id);
    layer.set(id, d);
    return d;
  }
  for (const item of ordered) depth(item.id);

  const perLayerCount = new Map<number, number>();
  const nodes: GraphNode[] = ordered.map((item) => {
    const l = layer.get(item.id) ?? 0;
    const idx = perLayerCount.get(l) ?? 0;
    perLayerCount.set(l, idx + 1);
    return { id: item.id, item, layer: l, index: idx };
  });

  const layerCount = nodes.reduce((m, n) => Math.max(m, n.layer + 1), 0);
  const maxLayerSize = [...perLayerCount.values()].reduce((m, v) => Math.max(m, v), 0);

  return { nodes, edges, layerCount, maxLayerSize };
}

// "Show chains" (SPEC §7.11): highlight blocker dependency paths and their root
// blockers. Structural definition — a root blocker blocks ≥1 item and is itself
// blocked by none in-set; the chain is everything reachable from it along
// blocked edges.
export function analyseChains(model: GraphModel): ChainAnalysis {
  const blockedEdges = model.edges.filter((e) => e.kind === 'blocked');
  const blocksOut = new Map<string, GraphEdge[]>();
  const blockedIn = new Set<string>();
  for (const e of blockedEdges) {
    const arr = blocksOut.get(e.from) ?? [];
    arr.push(e);
    blocksOut.set(e.from, arr);
    blockedIn.add(e.to);
  }

  const rootBlockerIds = new Set<string>();
  for (const id of blocksOut.keys()) {
    if (!blockedIn.has(id)) rootBlockerIds.add(id);
  }

  const chainNodeIds = new Set<string>();
  const chainEdgeIds = new Set<string>();
  const stack = [...rootBlockerIds];
  for (const r of rootBlockerIds) chainNodeIds.add(r);
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const e of blocksOut.get(cur) ?? []) {
      chainEdgeIds.add(e.id);
      if (!chainNodeIds.has(e.to)) {
        chainNodeIds.add(e.to);
        stack.push(e.to);
      }
    }
  }

  return { rootBlockerIds, chainNodeIds, chainEdgeIds };
}

export interface LayoutOpts {
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
  padding: number;
}

export const DEFAULT_LAYOUT: LayoutOpts = {
  nodeWidth: 184,
  nodeHeight: 64,
  gapX: 36,
  gapY: 64,
  padding: 32,
};

export interface PlacedNode extends GraphNode {
  x: number;
  y: number;
}

export interface LayoutResult {
  placed: PlacedNode[];
  byId: Map<string, PlacedNode>;
  width: number;
  height: number;
}

// Deterministic top-down layered placement. Layer → row (y); within-layer index
// → column (x), each layer centred against the widest layer so the graph reads
// as a balanced tree rather than left-ragged.
export function computeLayout(model: GraphModel, opts: LayoutOpts = DEFAULT_LAYOUT): LayoutResult {
  const { nodeWidth, nodeHeight, gapX, gapY, padding } = opts;
  const sizeByLayer = new Map<number, number>();
  for (const n of model.nodes) {
    sizeByLayer.set(n.layer, Math.max(sizeByLayer.get(n.layer) ?? 0, n.index + 1));
  }
  const maxLayerSize = [...sizeByLayer.values()].reduce((m, v) => Math.max(m, v), 1);
  const rowWidth = maxLayerSize * nodeWidth + (maxLayerSize - 1) * gapX;

  const placed: PlacedNode[] = model.nodes.map((n) => {
    const layerSize = sizeByLayer.get(n.layer) ?? 1;
    const layerWidth = layerSize * nodeWidth + (layerSize - 1) * gapX;
    const offset = (rowWidth - layerWidth) / 2;
    return {
      ...n,
      x: padding + offset + n.index * (nodeWidth + gapX),
      y: padding + n.layer * (nodeHeight + gapY),
    };
  });

  const byId = new Map(placed.map((p) => [p.id, p]));
  const width = rowWidth + padding * 2;
  const height =
    (model.layerCount > 0 ? model.layerCount * nodeHeight + (model.layerCount - 1) * gapY : 0) +
    padding * 2;

  return { placed, byId, width, height };
}
