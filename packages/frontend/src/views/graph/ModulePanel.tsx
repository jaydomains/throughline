// Phase 18 Slice 4 — side panel for the communication-model graph.
// Shows a single module's ref, tier, item count, and the list of derived edges
// it participates in (with edge type, partner module, mechanism, contract
// source slug if any). Mirrors the close/cycle shape of ItemDetailPanel without
// the keyboard navigation since modules don't have a stable "next module" order
// at this slice.

import type { CommunicationGraph, GraphEdge } from '@throughline/shared';

interface Props {
  graph: CommunicationGraph;
  selectedRef: string;
  onClose: () => void;
}

export function ModulePanel({ graph, selectedRef, onClose }: Props) {
  const module = graph.modules.find((m) => m.ref === selectedRef);
  if (!module) return null;
  const edges = graph.edges.filter(
    (e) => e.endpoints[0] === selectedRef || e.endpoints[1] === selectedRef,
  );
  return (
    <aside className="module-panel" data-testid="module-panel" aria-label="Module detail">
      <div className="module-panel-header">
        <h2>
          <code>{module.ref}</code>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close module panel"
          data-testid="module-panel-close"
        >
          ×
        </button>
      </div>
      <dl className="module-panel-meta">
        <dt>Tier</dt>
        <dd data-testid="module-panel-tier">{module.tier ?? 'unassigned'}</dd>
        <dt>Items referencing</dt>
        <dd>{module.item_count}</dd>
        <dt>Producer-owns-shape</dt>
        <dd>{graph.producer_owns_shape ? 'yes' : 'no'}</dd>
      </dl>
      <h3>Edges</h3>
      {edges.length === 0 ? (
        <p className="settings-hint" data-testid="module-panel-no-edges">
          No edges touch this module.
        </p>
      ) : (
        <ul className="module-panel-edges" data-testid="module-panel-edges">
          {edges.map((e) => (
            <ModuleEdgeRow key={edgeId(e)} edge={e} selfRef={selectedRef} />
          ))}
        </ul>
      )}
    </aside>
  );
}

function ModuleEdgeRow({ edge, selfRef }: { edge: GraphEdge; selfRef: string }) {
  const partner = edge.endpoints[0] === selfRef ? edge.endpoints[1] : edge.endpoints[0];
  const mechanism =
    edge.mechanism.kind === 'direct' ? 'direct' : `via ${edge.mechanism.module_id}`;
  const cls = ['module-panel-edge'];
  if (edge.invariant === 'violation') cls.push('violation');
  return (
    <li className={cls.join(' ')} data-testid={`module-panel-edge-${edgeId(edge)}`}>
      <div>
        <code>{edge.edge_type}</code> → <code>{partner}</code>
      </div>
      <div className="settings-hint">
        {mechanism}
        {edge.contract_source && <> · contract: <code>{edge.contract_source}</code></>}
        {edge.mechanism_overridden_by_tier && (
          <> · routed by tier <code>{edge.mechanism_overridden_by_tier}</code></>
        )}
        {edge.invariant === 'violation' && (
          <span className="settings-warning"> · invariant: violation</span>
        )}
      </div>
    </li>
  );
}

function edgeId(e: GraphEdge): string {
  return `${e.edge_type}:${e.endpoints[0]}->${e.endpoints[1]}`;
}
