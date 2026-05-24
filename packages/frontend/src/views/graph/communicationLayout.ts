// Phase 18 Slice 4 — pure swimlane layout for the communication-model graph.
//
// One horizontal lane per architectural tier (in the order the bundle's §2
// `tiers:` declared them), plus an "unassigned" lane at the bottom if any
// modules have tier=null. Modules within a lane sort by ref for stable layout.
//
// Edge geometry for direct edges is a single curve A→B. Mediated edges
// (`mechanism.kind === 'via'`) decompose into two curves through the mediator
// module IF the mediator is itself a module in the graph; otherwise the edge
// renders as a single curve carrying a `via <id>` badge (the badge text is the
// declared mediator id — the renderer chooses where to place it).
//
// Everything deterministic and side-effect-free so the renderer is reproducible
// in jsdom.

import type { CommunicationGraph, GraphEdge, GraphModule } from '@throughline/shared';

export interface CommLayoutOpts {
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  laneHeight: number;
  padding: number;
  laneLabelWidth: number;
}

export const DEFAULT_COMM_LAYOUT: CommLayoutOpts = {
  nodeWidth: 168,
  nodeHeight: 54,
  gapX: 36,
  laneHeight: 110,
  padding: 32,
  laneLabelWidth: 120,
};

export interface PlacedCommModule extends GraphModule {
  x: number;
  y: number;
  // Centre point used by edge geometry.
  cx: number;
  cy: number;
}

export interface PlacedLane {
  tier: string; // 'unassigned' for the catch-all lane
  label: string; // 'tier-a' or 'unassigned'
  y: number;
  width: number;
  height: number;
}

// One placed edge per derived GraphEdge. For mediated edges where the mediator
// module is in the graph, `via` carries that module's centre point so the
// renderer can draw two arcs. Otherwise `via` is null and the renderer falls
// back to a single arc + a `via_label` badge.
export interface PlacedCommEdge {
  edge: GraphEdge;
  from: PlacedCommModule;
  to: PlacedCommModule;
  via: PlacedCommModule | null;
  via_label: string | null;
}

export interface CommLayoutResult {
  modules: PlacedCommModule[];
  modulesById: Map<string, PlacedCommModule>;
  lanes: PlacedLane[];
  edges: PlacedCommEdge[];
  width: number;
  height: number;
}

export function computeCommunicationLayout(
  graph: CommunicationGraph,
  declared_tiers: readonly string[],
  opts: CommLayoutOpts = DEFAULT_COMM_LAYOUT,
): CommLayoutResult {
  const { nodeWidth, nodeHeight, gapX, laneHeight, padding, laneLabelWidth } = opts;

  // Lane order: declared tiers in §2 order, then 'unassigned' iff any module is unassigned.
  const hasUnassigned = graph.modules.some((m) => m.tier === null);
  const tierOrder: string[] = [...declared_tiers];
  if (hasUnassigned) tierOrder.push('unassigned');

  // Modules per lane, sorted by ref. Modules with tier=null (or tier not in
  // declared_tiers — shouldn't happen since the resolver filters those, but
  // defensive) route to 'unassigned'.
  const tierSet = new Set(declared_tiers);
  const byLane = new Map<string, GraphModule[]>();
  for (const t of tierOrder) byLane.set(t, []);
  for (const m of graph.modules) {
    const lane = m.tier !== null && tierSet.has(m.tier) ? m.tier : 'unassigned';
    if (!byLane.has(lane)) byLane.set(lane, []);
    byLane.get(lane)!.push(m);
  }
  for (const list of byLane.values()) {
    list.sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
  }

  // Place modules. x grows within a lane; y picked by the lane's row.
  const placed: PlacedCommModule[] = [];
  const lanes: PlacedLane[] = [];
  let maxRowWidth = 0;
  let laneIdx = 0;
  for (const lane of tierOrder) {
    const ms = byLane.get(lane) ?? [];
    const laneY = padding + laneIdx * laneHeight;
    const rowWidth = ms.length === 0 ? 0 : ms.length * nodeWidth + (ms.length - 1) * gapX;
    lanes.push({
      tier: lane,
      label: lane,
      y: laneY,
      width: laneLabelWidth + rowWidth + padding,
      height: laneHeight,
    });
    ms.forEach((m, i) => {
      const x = padding + laneLabelWidth + i * (nodeWidth + gapX);
      const y = laneY + (laneHeight - nodeHeight) / 2;
      placed.push({
        ...m,
        x,
        y,
        cx: x + nodeWidth / 2,
        cy: y + nodeHeight / 2,
      });
    });
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
    laneIdx++;
  }

  const modulesById = new Map(placed.map((p) => [p.ref, p] as const));

  // Place edges. For via-mechanism edges, resolve the mediator to a placed module
  // if its id matches; otherwise emit a label-only via.
  const edges: PlacedCommEdge[] = [];
  for (const e of graph.edges) {
    const a = modulesById.get(e.endpoints[0]);
    const b = modulesById.get(e.endpoints[1]);
    if (!a || !b) continue; // defensive: derive shouldn't emit edges to missing modules
    let via: PlacedCommModule | null = null;
    let via_label: string | null = null;
    if (e.mechanism.kind === 'via') {
      const mediator = modulesById.get(e.mechanism.module_id);
      if (mediator) via = mediator;
      else via_label = e.mechanism.module_id;
    }
    edges.push({ edge: e, from: a, to: b, via, via_label });
  }

  const width = padding + laneLabelWidth + maxRowWidth + padding;
  const height = padding + tierOrder.length * laneHeight + padding;
  return { modules: placed, modulesById, lanes, edges, width, height };
}
