// Phase 18 Slice 4 — SVG renderer for the rule-level communication-model graph.
// Module nodes laid out by tier swimlane; direct edges drawn as a single curve;
// mediated edges drawn as two curves through the mediator's module node when the
// mediator is itself in the graph, otherwise as a single curve with a `via <id>`
// badge. Edges flagged `invariant: 'violation'` render in the danger style.

import type { CommunicationGraph } from '@throughline/shared';
import {
  computeCommunicationLayout,
  DEFAULT_COMM_LAYOUT,
  type PlacedCommEdge,
  type PlacedCommModule,
  type CommLayoutResult,
} from './communicationLayout.js';
import { edgeId } from './commUtils.js';

const NW = DEFAULT_COMM_LAYOUT.nodeWidth;
const NH = DEFAULT_COMM_LAYOUT.nodeHeight;

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const my = (y1 + y2) / 2;
  return `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

interface CanvasProps {
  graph: CommunicationGraph;
  declared_tiers: readonly string[];
  selectedRef: string | null;
  onSelectModule: (ref: string) => void;
}

export function CommunicationGraphCanvas({
  graph,
  declared_tiers,
  selectedRef,
  onSelectModule,
}: CanvasProps) {
  const layout: CommLayoutResult = computeCommunicationLayout(graph, declared_tiers);
  const viewW = Math.max(layout.width, 480);
  const viewH = Math.max(layout.height, 240);

  return (
    <svg
      className="gv-canvas comm"
      data-testid="comm-graph-canvas"
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label="Communication-model graph"
    >
      <defs>
        <marker
          id="comm-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0L8 4L0 8z" fill="context-stroke" />
        </marker>
      </defs>

      {layout.lanes.map((lane) => (
        <g key={lane.tier} data-testid={`comm-lane-${lane.tier}`}>
          <line
            className="comm-lane-divider"
            x1={0}
            y1={lane.y}
            x2={viewW}
            y2={lane.y}
          />
          <text className="comm-lane-label" x={12} y={lane.y + 20}>
            {lane.label}
          </text>
        </g>
      ))}

      {layout.edges.map((pe) => (
        <CommEdgeView key={edgeId(pe.edge)} placed={pe} />
      ))}

      {layout.modules.map((m) => (
        <CommModuleView
          key={m.ref}
          module={m}
          selected={selectedRef === m.ref}
          onSelect={() => onSelectModule(m.ref)}
        />
      ))}
    </svg>
  );
}

function CommModuleView({
  module: m,
  selected,
  onSelect,
}: {
  module: PlacedCommModule;
  selected: boolean;
  onSelect: () => void;
}) {
  const cls = ['gv-node', 'comm-module', selected ? 'selected' : ''].filter(Boolean).join(' ');
  return (
    <g
      className={cls}
      data-testid={`comm-module-${m.ref}`}
      transform={`translate(${m.x} ${m.y})`}
      role="button"
      tabIndex={0}
      aria-label={`Module ${m.ref}${m.tier ? `, tier ${m.tier}` : ', unassigned'}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <rect className="gv-node-box" width={NW} height={NH} />
      <text className="gv-node-title" x={12} y={22}>
        {m.ref}
      </text>
      <text className="gv-node-id" x={12} y={NH - 12}>
        {m.tier ?? 'unassigned'} · {m.item_count} item{m.item_count === 1 ? '' : 's'}
      </text>
    </g>
  );
}

function CommEdgeView({ placed }: { placed: PlacedCommEdge }) {
  const { edge, from, to, via, via_label } = placed;
  const baseCls = ['comm-edge'];
  if (edge.invariant === 'violation') baseCls.push('violation');
  if (edge.mechanism_overridden_by_tier !== null) baseCls.push('routed');
  const cls = baseCls.join(' ');
  const id = edgeId(edge);

  // Direct edge: single curve from from→to.
  // Via with in-graph mediator: two curves, from→via and via→to. Both arrowed.
  // Via with off-graph mediator: single curve plus a label badge at midpoint.
  if (edge.mechanism.kind === 'direct' || (edge.mechanism.kind === 'via' && via === null)) {
    return (
      <g data-testid={`comm-edge-${id}`} data-edge-type={edge.edge_type}>
        <path
          className={cls}
          d={curve(from.cx, from.cy, to.cx, to.cy)}
          markerEnd="url(#comm-arrow)"
        />
        {via_label !== null && (
          <text
            className="comm-edge-label"
            x={(from.cx + to.cx) / 2}
            y={(from.cy + to.cy) / 2 - 8}
            textAnchor="middle"
            data-testid={`comm-edge-${id}-via-label`}
          >
            via {via_label}
          </text>
        )}
      </g>
    );
  }

  // mechanism.kind === 'via' && via is in graph → two curves.
  return (
    <g
      data-testid={`comm-edge-${id}`}
      data-edge-type={edge.edge_type}
      data-mediated="true"
    >
      <path
        className={cls}
        d={curve(from.cx, from.cy, via!.cx, via!.cy)}
        markerEnd="url(#comm-arrow)"
      />
      <path
        className={cls}
        d={curve(via!.cx, via!.cy, to.cx, to.cy)}
        markerEnd="url(#comm-arrow)"
      />
    </g>
  );
}
