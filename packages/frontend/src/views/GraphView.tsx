import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CommunicationGraph } from '@throughline/shared';
import { api } from '../api.js';
import { useItemPolicy } from '../hooks/useItemPolicy.js';
import { useItems } from '../hooks/useItems.js';
import { useStaleThreshold, isStale } from '../hooks/useStaleThreshold.js';
import { ItemDetailPanel } from '../components/ItemDetailPanel.js';
import { LoadError } from '../components/LoadError.js';
import {
  analyseChains,
  buildGraph,
  computeLayout,
  DEFAULT_LAYOUT,
  type PlacedNode,
} from './graph/layout.js';
import { CommunicationGraphCanvas } from './graph/CommunicationGraphCanvas.js';
import { computeCommItemsKey } from './graph/commUtils.js';
import { ModulePanel } from './graph/ModulePanel.js';
import './graph/graph.css';

const NW = DEFAULT_LAYOUT.nodeWidth;
const NH = DEFAULT_LAYOUT.nodeHeight;
const ZOOM_STEP = 1.25;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function GraphView() {
  const { id } = useParams();
  const projectId = id ?? null;
  const { policy } = useItemPolicy(projectId);
  const { items, refresh, error: itemsError } = useItems({ projectId });
  const staleDays = useStaleThreshold();

  const [showChains, setShowChains] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [panning, setPanning] = useState(false);

  // Phase 18 Slice 4 — communication-model fourth layer. Coupled freshness
  // (T-D50 render property): the comm graph re-derives whenever the project's
  // item set changes, since the synthesised module set comes from items'
  // `primary_unit_refs` and per-module item counts. We project items to a
  // stable key of `ref:count|…` so the effect refetches only on changes that
  // can affect the graph — not on title/status/description edits.
  const [commGraph, setCommGraph] = useState<CommunicationGraph | null>(null);
  const [commDeclaredTiers, setCommDeclaredTiers] = useState<readonly string[]>([]);
  const [showComm, setShowComm] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const commItemsKey = useMemo(() => computeCommItemsKey(items), [items]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void Promise.all([
      api.getCommunicationGraph(projectId),
      api.getCommunicationModel(projectId),
    ])
      .then(([graph, view]) => {
        if (cancelled) return;
        setCommGraph(graph);
        setCommDeclaredTiers(view.resolved.declared_tiers);
      })
      .catch(() => {
        // Comm graph is opt-in eye-candy — keep the rest of GraphView working on failure.
      });
    return () => {
      cancelled = true;
    };
    // commItemsKey is the coupled-freshness dependency; projectId covers
    // project switches.
  }, [projectId, commItemsKey]);

  // Hide the toggle entirely when the project has no communication model
  // declared (freeform-shape: empty modules + empty edges + producer_owns_shape=false
  // implies §6 = none after Slice 3's derivation; the bundle-status proxy via
  // the view endpoint's declared_tiers also distinguishes empty-declared vs none).
  const commAvailable =
    commGraph !== null && (commGraph.modules.length > 0 || commDeclaredTiers.length > 0);

  const { model, layout, chains } = useMemo(() => {
    const m = buildGraph(items);
    return { model: m, layout: computeLayout(m), chains: analyseChains(m) };
  }, [items]);

  const orderedIds = useMemo(() => model.nodes.map((n) => n.id), [model]);

  if (!projectId) return null;

  const viewW = Math.max(layout.width, 480);
  const viewH = Math.max(layout.height, 360);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    setPanning(true);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = dragRef.current;
    if (!d) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  }
  function endPan() {
    dragRef.current = null;
    setPanning(false);
  }

  const empty = model.nodes.length === 0;

  return (
    <div className="graph-view" data-testid="graph-view">
      <div className="gv-hero">
        <div className="gv-eyebrow">View · graph</div>
        <h1 className="gv-h1">Graph</h1>
      </div>
      <LoadError error={itemsError} what="items" />

      <div className="gv-toolbar">
        <button
          type="button"
          className={showChains ? 'on' : ''}
          aria-pressed={showChains}
          disabled={showComm}
          onClick={() => setShowChains((v) => !v)}
          data-testid="graph-toggle-chains"
        >
          Show chains
        </button>
        {commAvailable && (
          <button
            type="button"
            className={showComm ? 'on' : ''}
            aria-pressed={showComm}
            onClick={() => {
              setShowComm((v) => !v);
              setSelectedId(null);
              setSelectedModule(null);
            }}
            data-testid="graph-toggle-comm"
          >
            Show communication model
          </button>
        )}
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP))}
          data-testid="graph-zoom-in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP))}
          data-testid="graph-zoom-out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          data-testid="graph-zoom-reset"
        >
          Reset
        </button>
        {showChains && (
          <span data-testid="graph-rootblocker-count">
            {chains.rootBlockerIds.size} root blocker
            {chains.rootBlockerIds.size === 1 ? '' : 's'}
          </span>
        )}
        <div className="gv-legend" aria-hidden="true">
          <span style={{ color: 'var(--gv-fg-muted)' }}>
            <i /> parent
          </span>
          <span style={{ color: 'var(--gv-danger)' }}>
            <i className="dashed" /> blocked-by
          </span>
          <span style={{ color: 'var(--accent)' }}>
            <i className="dotted" /> mentions
          </span>
        </div>
      </div>

      {showComm && commGraph ? (
        commGraph.modules.length === 0 ? (
          <div className="gv-empty" data-testid="comm-empty">
            <strong>No modules to graph</strong>
            <span>
              Items haven't referenced any primary units yet. Add modules via
              item methodology context to populate this view.
            </span>
          </div>
        ) : (
          <div className="gv-canvas-wrap">
            <CommunicationGraphCanvas
              graph={commGraph}
              declared_tiers={commDeclaredTiers}
              selectedRef={selectedModule}
              onSelectModule={setSelectedModule}
            />
          </div>
        )
      ) : empty ? (
        <div className="gv-empty" data-testid="graph-empty">
          <strong>No items to graph</strong>
          <span>
            Create items with parents or structured blockers and they’ll render
            as a node-edge graph here.
          </span>
        </div>
      ) : (
        <div className="gv-canvas-wrap">
          <svg
            className={`gv-canvas${panning ? ' panning' : ''}`}
            data-testid="graph-canvas"
            viewBox={`${-pan.x / zoom} ${-pan.y / zoom} ${viewW / zoom} ${viewH / zoom}`}
            preserveAspectRatio="xMidYMin meet"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPan}
            onPointerLeave={endPan}
            role="img"
            aria-label="Item graph"
          >
            <defs>
              <marker
                id="gv-arrow"
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

            {model.edges.map((e) => {
              const a = layout.byId.get(e.from);
              const b = layout.byId.get(e.to);
              if (!a || !b) return null;
              const x1 = a.x + NW / 2;
              const y1 = a.y + NH;
              const x2 = b.x + NW / 2;
              const y2 = b.y;
              const my = (y1 + y2) / 2;
              const inChain = chains.chainEdgeIds.has(e.id);
              const dim = showChains && !inChain;
              const cls = [
                'gv-edge',
                e.kind === 'blocked' ? 'blocked' : '',
                e.kind === 'mentions' ? 'mentions' : '',
                showChains && inChain ? 'chain' : '',
                dim ? 'dim' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <path
                  key={e.id}
                  className={cls}
                  data-testid={`graph-edge-${e.id}`}
                  data-kind={e.kind}
                  d={`M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                  markerEnd="url(#gv-arrow)"
                />
              );
            })}

            {layout.placed.map((n) => (
              <GraphNodeView
                key={n.id}
                node={n}
                selected={selectedId === n.id}
                rootBlocker={chains.rootBlockerIds.has(n.id)}
                dim={showChains && !chains.chainNodeIds.has(n.id)}
                stale={isStale(n.item.updated_at, staleDays)}
                drift={n.item.methodology_drift || n.item.code_drift_tier !== null}
                onSelect={() => setSelectedId(n.id)}
              />
            ))}
          </svg>
        </div>
      )}

      {!showComm && selectedId && policy && (
        <ItemDetailPanel
          projectId={projectId}
          itemId={selectedId}
          policy={policy}
          staleDays={staleDays}
          siblings={orderedIds}
          onCycle={setSelectedId}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      )}
      {showComm && commGraph && selectedModule && (
        <ModulePanel
          graph={commGraph}
          selectedRef={selectedModule}
          onClose={() => setSelectedModule(null)}
        />
      )}
    </div>
  );
}

interface NodeViewProps {
  node: PlacedNode;
  selected: boolean;
  rootBlocker: boolean;
  dim: boolean;
  stale: boolean;
  drift: boolean;
  onSelect: () => void;
}

function GraphNodeView({
  node,
  selected,
  rootBlocker,
  dim,
  stale,
  drift,
  onSelect,
}: NodeViewProps) {
  const cls = [
    'gv-node',
    selected ? 'selected' : '',
    rootBlocker ? 'root-blocker' : '',
    dim ? 'dim' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <g
      className={cls}
      data-testid={`graph-node-${node.id}`}
      transform={`translate(${node.x} ${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${node.item.title} (${node.item.status})`}
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
        {truncate(node.item.title, 24)}
      </text>
      <text className="gv-node-id" x={12} y={NH - 14}>
        {node.id.slice(0, 8)}
      </text>
      <text className="gv-node-status" x={12} y={NH - 14} dx={70}>
        {node.item.status}
      </text>
      {stale && (
        <g transform={`translate(${NW - 38} 10)`} data-testid={`graph-node-stale-${node.id}`}>
          <rect className="gv-pill-box stale" width={26} height={14} />
          <text className="gv-pill-text stale" x={13} y={10} textAnchor="middle">
            ⚑
          </text>
        </g>
      )}
      {drift && (
        <g transform={`translate(${NW - 38} ${NH - 24})`} data-testid={`graph-node-drift-${node.id}`}>
          <rect className="gv-pill-box drift" width={26} height={14} />
          <text className="gv-pill-text drift" x={13} y={10} textAnchor="middle">
            ↯
          </text>
        </g>
      )}
    </g>
  );
}
