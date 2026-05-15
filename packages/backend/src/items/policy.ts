import type { Board, ItemPolicy, LoadedBundle } from '@throughline/shared';

// Bundle-derived item policy (SPEC §7.3–§7.5, T-D47, C-D12).
//
// A bundle declares item types in its State machine section via `### Item type: <id>`
// sub-blocks (parsed into `state_machine.item_types`). Each declared type becomes one board
// with its own status lifecycle:
//
//   - SiteMesh: `todo` (board "Todos", statuses todo/in-progress/blocked/done) and
//     `decision` (board "Decisions", statuses open/locked/superseded) — two boards.
//   - freeform: declares no item types, so the runtime infers a single board "Tasks" with
//     item type "task" and statuses drawn from the state machine's phases (['open','done']).
//
// The runtime stays methodology-agnostic at the item-row level: every consumer asks the
// policy for "what types / statuses / boards apply to this project."

const FREEFORM_FALLBACK_STATUSES = ['open', 'done'];

function unionStatuses(statusesByType: Record<string, string[]>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of Object.values(statusesByType)) {
    for (const s of list) {
      if (!seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out;
}

export function bundleItemPolicy(bundle: LoadedBundle): ItemPolicy {
  const declared = bundle.state_machine.item_types;
  if (declared.length > 0) {
    const statuses_by_type: Record<string, string[]> = {};
    const boards: Board[] = [];
    for (const t of declared) {
      const statuses = t.statuses.length > 0 ? t.statuses : FREEFORM_FALLBACK_STATUSES;
      statuses_by_type[t.id] = statuses;
      boards.push({ id: t.id, label: t.board_label, type: t.id, statuses });
    }
    return {
      bundle_id: bundle.bundle_id,
      types: declared.map((t) => t.id),
      statuses: unionStatuses(statuses_by_type),
      statuses_by_type,
      boards,
    };
  }

  // No item types declared: infer a single board from the state machine's phases. Used by
  // freeform and by any bundle that has not declared item types.
  const phases =
    bundle.state_machine.phases.length > 0 ? bundle.state_machine.phases : FREEFORM_FALLBACK_STATUSES;
  const type = bundle.bundle_id === 'freeform' ? 'task' : bundle.bundle_id;
  const label = bundle.bundle_id === 'freeform' ? 'Tasks' : type;
  return {
    bundle_id: bundle.bundle_id,
    types: [type],
    statuses: phases,
    statuses_by_type: { [type]: phases },
    boards: [{ id: type === 'task' ? 'tasks' : type, label, type, statuses: phases }],
  };
}

// "Done"-equivalent status for a given item type — the last status in that type's declared
// lifecycle. Works for freeform (`['open','done']`) and the SiteMesh todo lifecycle whose
// terminal state is `done`. Decisions have no terminal "done"; callers that need a generic
// done concept pass the union and get the last overall status.
export function bundleDoneStatus(policy: { statuses: string[] }): string {
  if (policy.statuses.length === 0) return 'done';
  return policy.statuses[policy.statuses.length - 1]!;
}

export function bundleDoneStatusForType(policy: ItemPolicy, type: string): string {
  const list = policy.statuses_by_type[type] ?? policy.statuses;
  if (list.length === 0) return 'done';
  return list[list.length - 1]!;
}
