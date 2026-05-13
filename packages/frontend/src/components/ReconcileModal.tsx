import { useEffect, useMemo, useState } from 'react';
import type {
  ReconcileApplyResult,
  ReconcileCategory,
  ReconcileDiff,
  ReconcileRow,
  ReconcileRowDecision,
  ReconcileRun,
} from '@throughline/shared';
import { api } from '../api.js';
import { useModalRegistration } from '../keyboard/modalStack.js';

// Reconcile review modal (SPEC §7.7, T-D35). Renders the six-category diff returned by the
// reconcile engine. Per-row accept/reject toggle; edited and new rows allow inline edits to
// the next title/description; contradicted rows are read-only with a "spawns drift signal"
// hint per T-D21. Apply applies via /reconcile/apply; cancel discards the run.

const CATEGORY_ORDER: ReconcileCategory[] = [
  'completed',
  'new',
  'edited',
  'blocker',
  'contradicted',
  'no_change',
];

const CATEGORY_LABEL: Record<ReconcileCategory, string> = {
  completed: 'Completed',
  new: 'New',
  edited: 'Edited',
  blocker: 'Blocker changes',
  contradicted: 'Contradicted',
  no_change: 'No change',
};

const CATEGORY_HINT: Record<ReconcileCategory, string> = {
  completed: 'Marks the item as done.',
  new: 'Creates a new item in this session.',
  edited: 'Updates title and description.',
  blocker: 'Replaces the blocker text on the item.',
  contradicted: 'Does NOT revert state — spawns a code-drift signal for review.',
  no_change: 'No mutation; recorded as reviewed.',
};

export interface ReconcileModalProps {
  open: boolean;
  run: ReconcileRun | null;
  projectId: string;
  onClose: () => void;
  onApplied: (result: ReconcileApplyResult) => void;
}

type RowState = {
  row: ReconcileRow;
  decision: ReconcileRowDecision;
};

export function ReconcileModal({ open, run, projectId, onClose, onApplied }: ReconcileModalProps) {
  useModalRegistration('reconcile-review', open, onClose);
  const [rows, setRows] = useState<RowState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open || !run) return;
    setRows(run.diff.rows.map((row) => ({ row, decision: 'accept' as ReconcileRowDecision })));
    setError(null);
    setApplying(false);
  }, [open, run]);

  const acceptedCount = useMemo(
    () => rows.filter((r) => r.decision === 'accept').length,
    [rows],
  );

  const byCategory = useMemo(() => {
    const m = new Map<ReconcileCategory, RowState[]>();
    for (const c of CATEGORY_ORDER) m.set(c, []);
    for (const r of rows) m.get(r.row.category)!.push(r);
    return m;
  }, [rows]);

  if (!open || !run) return null;

  function setRow(rowId: string, next: Partial<RowState> & { rowPatch?: Partial<ReconcileRow> }) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.row.row_id !== rowId) return r;
        const merged: RowState = {
          ...r,
          ...next,
          row: next.rowPatch
            ? ({ ...r.row, ...next.rowPatch } as ReconcileRow)
            : r.row,
        };
        return merged;
      }),
    );
  }

  async function cancel() {
    if (!run) return;
    try {
      await api.discardReconcileRun(projectId, run.id);
    } catch {
      // Discard failures are non-fatal — the run remains pending and can be discarded later
      // from the reconcile history surface (lands with Phase 14 hygiene queries).
    }
    onClose();
  }

  async function apply() {
    if (!run || applying) return;
    setApplying(true);
    setError(null);
    const decisions: Record<string, ReconcileRowDecision> = {};
    for (const r of rows) {
      if (r.decision === 'reject') decisions[r.row.row_id] = 'reject';
    }
    const diff: ReconcileDiff = {
      ...run.diff,
      rows: rows.map((r) => r.row),
    };
    try {
      const r = await api.applyReconcile(projectId, {
        run_id: run.id,
        diff,
        decisions,
      });
      setApplying(false);
      onApplied(r.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setApplying(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-label="Review reconcile diff"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal reconcile-modal" data-testid="reconcile-modal">
        <h2 style={{ marginTop: 0 }}>Review reconcile diff</h2>
        <p className="form-hint">
          Source: {run.source} · Extractor:{' '}
          {run.diff.extractor === 'anthropic' ? 'AI (Anthropic)' : 'Heuristic'} · {rows.length} row
          {rows.length === 1 ? '' : 's'}.
        </p>
        {run.diff.extractor_note && (
          <p className="form-hint" data-testid="reconcile-extractor-note">
            {run.diff.extractor_note}
          </p>
        )}
        {CATEGORY_ORDER.map((cat) => {
          const list = byCategory.get(cat) ?? [];
          if (list.length === 0) return null;
          return (
            <section
              key={cat}
              className={`reconcile-section reconcile-section-${cat}`}
              data-testid={`reconcile-section-${cat}`}
            >
              <h3>
                {CATEGORY_LABEL[cat]} ({list.length})
              </h3>
              <p className="form-hint">{CATEGORY_HINT[cat]}</p>
              <ul className="reconcile-rows">
                {list.map(({ row, decision }) => (
                  <li
                    key={row.row_id}
                    className="reconcile-row"
                    data-testid={`reconcile-row-${row.row_id}`}
                  >
                    <label className="reconcile-row-keep">
                      <input
                        type="checkbox"
                        checked={decision === 'accept'}
                        onChange={(e) =>
                          setRow(row.row_id, {
                            decision: e.target.checked ? 'accept' : 'reject',
                          })
                        }
                        aria-label="Accept this row"
                      />
                      <span className="reconcile-row-keep-label">Accept</span>
                    </label>
                    <div className="reconcile-row-body">{renderRowBody(row, (patch) => setRow(row.row_id, { rowPatch: patch }))}</div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {rows.length === 0 && (
          <p className="form-hint">No rows in this diff.</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" onClick={() => void cancel()} disabled={applying}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void apply()}
            disabled={applying || rows.length === 0}
            data-testid="reconcile-apply"
          >
            {applying ? 'Applying…' : `Apply (${acceptedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function renderRowBody(row: ReconcileRow, patch: (p: Partial<ReconcileRow>) => void) {
  switch (row.category) {
    case 'completed':
      return (
        <div>
          <strong>{row.current_title}</strong>
          <div className="form-hint">
            {row.current_status} → {row.next_status}
          </div>
          <pre className="reconcile-evidence">{row.evidence}</pre>
        </div>
      );
    case 'new':
      return (
        <div>
          <input
            type="text"
            value={row.title}
            onChange={(e) => patch({ title: e.target.value } as Partial<ReconcileRow>)}
            data-testid={`reconcile-row-${row.row_id}-title`}
          />
          <textarea
            value={row.description}
            onChange={(e) => patch({ description: e.target.value } as Partial<ReconcileRow>)}
            placeholder="Description"
          />
          <pre className="reconcile-evidence">{row.evidence}</pre>
        </div>
      );
    case 'edited':
      return (
        <div>
          <div className="form-hint">Current: {row.current_title}</div>
          <input
            type="text"
            value={row.next_title}
            onChange={(e) => patch({ next_title: e.target.value } as Partial<ReconcileRow>)}
            data-testid={`reconcile-row-${row.row_id}-title`}
          />
          <textarea
            value={row.next_description}
            onChange={(e) => patch({ next_description: e.target.value } as Partial<ReconcileRow>)}
          />
          <pre className="reconcile-evidence">{row.evidence}</pre>
        </div>
      );
    case 'blocker':
      return (
        <div>
          <div className="form-hint">
            Current blocker: {row.current_blocker_text ? row.current_blocker_text : '(none)'}
          </div>
          <input
            type="text"
            value={row.next_blocker_text ?? ''}
            onChange={(e) =>
              patch({
                next_blocker_text: e.target.value.length === 0 ? null : e.target.value,
              } as Partial<ReconcileRow>)
            }
            placeholder="Next blocker text (empty to clear)"
          />
          <pre className="reconcile-evidence">{row.evidence}</pre>
        </div>
      );
    case 'contradicted':
      return (
        <div>
          <strong>{row.current_title}</strong>
          <div className="form-hint">{row.reason}</div>
          <pre className="reconcile-evidence">{row.evidence}</pre>
          <p className="form-hint" data-testid={`reconcile-row-${row.row_id}-drift-hint`}>
            Accepting creates a code-drift signal — state is not reverted.
          </p>
        </div>
      );
    case 'no_change':
      return (
        <div>
          <strong>{row.current_title}</strong>
          <pre className="reconcile-evidence">{row.evidence}</pre>
        </div>
      );
  }
}
