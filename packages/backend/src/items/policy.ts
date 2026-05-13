import type { Board, ItemPolicy, LoadedBundle } from '@throughline/shared';

// Bundle-derived item policy (SPEC §7.3–§7.5, T-D47).
//
// v1 ships two bundles; only freeform is exercised in Phase 3. The bundle markdown does not
// currently declare item types explicitly — types are inferred per bundle:
//
//   - freeform: a single board called "tasks" with item type "task" and statuses drawn from
//     the bundle's state_machine.phases (parsed as ['open','done']).
//
// SiteMesh wiring (Phase 7) extends the policy here to derive multi-board layouts (todo +
// decision) and per-type statuses (todo: todo/in-progress/blocked/done, decision: open/locked/
// superseded). The runtime stays methodology-agnostic at the item-row level: every consumer
// asks the policy for "what types / statuses / boards apply to this project."

const FREEFORM_FALLBACK_STATUSES = ['open', 'done'];

export function bundleItemPolicy(bundle: LoadedBundle): ItemPolicy {
  if (bundle.bundle_id === 'freeform') {
    const statuses =
      bundle.state_machine.phases.length > 0
        ? bundle.state_machine.phases
        : FREEFORM_FALLBACK_STATUSES;
    const boards: Board[] = [{ id: 'tasks', label: 'Tasks', type: 'task' }];
    return {
      bundle_id: bundle.bundle_id,
      types: ['task'],
      statuses,
      boards,
    };
  }
  // Pre-Phase-7 catch-all: any bundle whose item-type derivation hasn't landed yet renders as
  // a single board pulled from state-machine phases, plus a single placeholder type matching
  // the bundle_id. Phase 7 replaces this branch with SiteMesh's todo + decision boards.
  const statuses =
    bundle.state_machine.phases.length > 0
      ? bundle.state_machine.phases
      : FREEFORM_FALLBACK_STATUSES;
  const type = bundle.bundle_id;
  return {
    bundle_id: bundle.bundle_id,
    types: [type],
    statuses,
    boards: [{ id: type, label: type, type }],
  };
}

// "Done"-equivalent status for the policy. v1 convention: the last status in the bundle's
// declared list. Works for freeform (`['open','done']`) and the SiteMesh todo lifecycle
// whose terminal state is `done`. Flagged in the Phase 5 handover so a future T-D anchor
// can formalise if bundles emerge with a different terminal-state convention.
export function bundleDoneStatus(policy: { statuses: string[] }): string {
  if (policy.statuses.length === 0) return 'done';
  return policy.statuses[policy.statuses.length - 1]!;
}
