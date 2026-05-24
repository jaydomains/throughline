// Phase 18 Slice 3 — pure communication-graph derivation. Rule-level: each
// declared edge type expands into one edge per pair of modules whose tiers
// satisfy its `when:` clause. Self-loops excluded (an edge is communication
// BETWEEN modules). Tier-routing overrides replace the edge-type's mechanism
// on any edge touching a module of that tier. No FS reads, no item joins
// beyond what the modules service already produced.

import type {
  CommunicationEdgeType,
  CommunicationGraph,
  CommunicationModel,
  CommunicationModelView,
  GraphEdge,
  GraphModule,
  Mechanism,
  ModulesResult,
} from '@throughline/shared';

export interface DeriveCommunicationGraphInput {
  bundle: CommunicationModel;
  modules: ModulesResult;
  // module-name -> tier-name from the resolved view (only entries marked valid
  // contribute; invalid assignments and unassigned modules surface as null).
  module_tiers: CommunicationModelView['resolved']['module_tiers'];
}

export function deriveCommunicationGraph(input: DeriveCommunicationGraphInput): CommunicationGraph {
  const { bundle, modules, module_tiers } = input;

  const graphModules: GraphModule[] = modules.modules
    .map((m) => {
      const assignment = module_tiers[m.ref];
      const tier = assignment && assignment.valid ? assignment.tier : null;
      return { ref: m.ref, tier, item_count: m.item_count };
    })
    .sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));

  // Pre-build a tier-routing lookup. A tier's override applies to any edge
  // whose endpoint sits in that tier.
  const tierRoutingByTier = new Map<string, Mechanism>();
  for (const rule of bundle.tier_routing) {
    tierRoutingByTier.set(rule.tier, rule.mechanism);
  }

  const edges: GraphEdge[] = [];
  for (const edgeType of bundle.edge_types) {
    for (const [a, b] of unorderedPairs(graphModules)) {
      if (!whenMatches(edgeType, a, b)) continue;
      const baseMechanism = edgeType.mechanism;
      const [endpoints, overrideTier, overrideMechanism] = applyTierRouting(
        a,
        b,
        baseMechanism,
        tierRoutingByTier,
      );
      edges.push({
        edge_type: edgeType.name,
        endpoints,
        mechanism: overrideMechanism,
        contract_source: edgeType.contract_source,
        invariant: edgeType.invariant,
        mechanism_overridden_by_tier: overrideTier,
      });
    }
  }

  return {
    modules: graphModules,
    edges,
    producer_owns_shape: bundle.producer_ownership !== null,
  };
}

function whenMatches(edgeType: CommunicationEdgeType, a: GraphModule, b: GraphModule): boolean {
  if (edgeType.when.kind === 'any') return true;
  const { a: tA, b: tB } = edgeType.when;
  if (a.tier === null || b.tier === null) return false;
  return (
    (a.tier === tA && b.tier === tB) ||
    (a.tier === tB && b.tier === tA)
  );
}

// Enumerate unordered pairs from a sorted module list. Self-loops excluded:
// communication is BETWEEN modules. The sorted endpoints tuple gives stable
// edge identity across runs.
function* unorderedPairs(modules: GraphModule[]): Generator<[GraphModule, GraphModule]> {
  for (let i = 0; i < modules.length; i++) {
    for (let j = i + 1; j < modules.length; j++) {
      yield [modules[i]!, modules[j]!];
    }
  }
}

// Tier-routing precedence: if either endpoint sits in a tier with a routing rule,
// that rule wins over the edge-type's default mechanism. Conflict between two
// endpoints carrying different rules is resolved by sorting the tier names
// lexicographically and using the first — deterministic, surfaced via
// `mechanism_overridden_by_tier` so Slice 4 can render a warning if it wants.
function applyTierRouting(
  a: GraphModule,
  b: GraphModule,
  baseMechanism: Mechanism,
  tierRoutingByTier: Map<string, Mechanism>,
): [[string, string], string | null, Mechanism] {
  const endpoints: [string, string] = [a.ref, b.ref];
  const aRule = a.tier !== null ? tierRoutingByTier.get(a.tier) : undefined;
  const bRule = b.tier !== null ? tierRoutingByTier.get(b.tier) : undefined;
  if (!aRule && !bRule) return [endpoints, null, baseMechanism];
  if (aRule && !bRule) return [endpoints, a.tier, aRule];
  if (!aRule && bRule) return [endpoints, b.tier, bRule];
  // Both: pick the tier that sorts first for stability.
  const winner = a.tier! < b.tier! ? { tier: a.tier!, mechanism: aRule! } : { tier: b.tier!, mechanism: bRule! };
  return [endpoints, winner.tier, winner.mechanism];
}
