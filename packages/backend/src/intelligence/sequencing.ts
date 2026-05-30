import type { DoNextItem, DoNextResult } from '@throughline/shared';
import { ProjectNotFoundError } from '@throughline/shared';
import type { Item } from '@throughline/shared';
import type { ItemsService } from '../items/service.js';
import type { ProjectsService } from '../projects/service.js';
import type { GateRuntime } from '../methodology/gates/runtime.js';

// SPEC §7.18 dependency-aware sequencing. Topological sort across OPEN items, weighted by
// blocker-chain depth and the number of downstream items a completion unblocks. No AI —
// pure graph work, always available. Methodology-aware: an item whose primary unit has a
// failing, non-overridden gate is deprioritised pending gate clearance.
//
// Gate→primary-unit attribution is unspecified in SPEC v5.1 (gate findings carry optional
// `ref`s, not unit ids). Interpretation taken: a unit is "failing gates" when a latest,
// non-overridden firing with status fail|error has a finding `ref` that resolves to an
// item in that unit. A project-wide gate failure that names no in-unit item does not
// blanket-deprioritise every item (that would be punitive and wrong). Surfaced in the
// handover Open Questions, not silently resolved — no anchor minted.

export interface SequencingService {
  doNext(projectId: string): DoNextResult;
}

interface CreateOptions {
  projects: ProjectsService;
  items: ItemsService;
  gateRuntime: GateRuntime;
}

export function createSequencingService(opts: CreateOptions): SequencingService {
  const { projects, items, gateRuntime } = opts;

  function openFilter(projectId: string): (it: Item) => boolean {
    const policy = items.policy(projectId);
    return (it) => {
      const lc = policy.statuses_by_type[it.type] ?? policy.statuses ?? [];
      const terminal = lc[lc.length - 1];
      return terminal === undefined || it.status !== terminal;
    };
  }

  // Primary-unit refs that have a failing, non-overridden gate attributable to an item in
  // the unit (see header). Empty for freeform / no-gate bundles.
  function gateFailingUnits(projectId: string, openById: Map<string, Item>): Set<string> {
    const units = new Set<string>();
    const result = gateRuntime.listFirings(projectId);
    for (const group of result.groups) {
      for (const firing of group.firings) {
        if (firing.status !== 'fail' && firing.status !== 'error') continue;
        if (firing.findings.override) continue;
        for (const f of firing.findings.items) {
          if (!f.ref) continue;
          const it = openById.get(f.ref);
          if (it) for (const u of it.methodology_context.primary_unit_refs) units.add(u);
        }
      }
    }
    return units;
  }

  return {
    doNext(projectId) {
      if (!projects.get(projectId)) throw new ProjectNotFoundError(projectId);
      const isOpen = openFilter(projectId);
      const open = items.list({ project_id: projectId }).filter(isOpen);
      const openById = new Map(open.map((it) => [it.id, it]));

      // Edges restricted to the open sub-graph: a done blocker no longer blocks.
      const blockersOf = new Map<string, string[]>();
      const dependentsOf = new Map<string, string[]>();
      for (const it of open) {
        const bs = it.blockers.filter((b) => openById.has(b));
        blockersOf.set(it.id, bs);
        for (const b of bs) {
          const arr = dependentsOf.get(b) ?? [];
          arr.push(it.id);
          dependentsOf.set(b, arr);
        }
      }

      // Longest blocker chain leading into an item (depth). Memoised; the items service
      // prevents blocker cycles, the visited guard is belt-and-braces.
      const depthMemo = new Map<string, number>();
      function chainDepth(id: string, seen: Set<string>): number {
        const memo = depthMemo.get(id);
        if (memo !== undefined) return memo;
        if (seen.has(id)) return 0;
        seen.add(id);
        let d = 0;
        for (const b of blockersOf.get(id) ?? []) {
          d = Math.max(d, 1 + chainDepth(b, seen));
        }
        seen.delete(id);
        depthMemo.set(id, d);
        return d;
      }

      // Transitive set of items that (eventually) depend on `id` — completing `id`
      // contributes to unblocking all of them.
      const downstreamMemo = new Map<string, Set<string>>();
      function downstream(id: string, seen: Set<string>): Set<string> {
        const memo = downstreamMemo.get(id);
        if (memo) return memo;
        if (seen.has(id)) return new Set();
        seen.add(id);
        const acc = new Set<string>();
        for (const dep of dependentsOf.get(id) ?? []) {
          acc.add(dep);
          for (const x of downstream(dep, seen)) acc.add(x);
        }
        seen.delete(id);
        downstreamMemo.set(id, acc);
        return acc;
      }

      const failingUnits = gateFailingUnits(projectId, openById);

      const rows: DoNextItem[] = open.map((it) => {
        const bs = blockersOf.get(it.id) ?? [];
        const gateDep = it.methodology_context.primary_unit_refs.some((u) =>
          failingUnits.has(u),
        );
        return {
          id: it.id,
          title: it.title,
          ready: bs.length === 0,
          blocker_chain_depth: chainDepth(it.id, new Set()),
          downstream_unblocked: downstream(it.id, new Set()).size,
          gate_deprioritised: gateDep,
          primary_unit_refs: it.methodology_context.primary_unit_refs,
        };
      });

      const createdAt = new Map(open.map((it) => [it.id, it.created_at]));
      const sequence = [...rows].sort((a, b) => {
        // Gate-deprioritised sinks below everything else (pending gate clearance).
        if (a.gate_deprioritised !== b.gate_deprioritised) {
          return a.gate_deprioritised ? 1 : -1;
        }
        // Actionable (ready) before blocked.
        if (a.ready !== b.ready) return a.ready ? -1 : 1;
        // Higher downstream impact first.
        if (a.downstream_unblocked !== b.downstream_unblocked) {
          return b.downstream_unblocked - a.downstream_unblocked;
        }
        // Shallower blocker chain is sooner-actionable.
        if (a.blocker_chain_depth !== b.blocker_chain_depth) {
          return a.blocker_chain_depth - b.blocker_chain_depth;
        }
        const ca = createdAt.get(a.id) ?? '';
        const cb = createdAt.get(b.id) ?? '';
        return ca === cb ? a.id.localeCompare(b.id) : ca.localeCompare(cb);
      });

      const doNextRows = sequence.filter((r) => r.ready && !r.gate_deprioritised);
      const impactful = doNextRows.filter((r) => r.downstream_unblocked > 0).slice(0, 5);
      const freed = new Set<string>();
      for (const r of impactful) {
        for (const d of downstream(r.id, new Set())) freed.add(d);
      }

      return {
        sequence,
        do_next: doNextRows.slice(0, 10),
        unblock_impact: {
          if_you_unblock: impactful.map((r) => r.id),
          items_freed: freed.size,
        },
      };
    },
  };
}
