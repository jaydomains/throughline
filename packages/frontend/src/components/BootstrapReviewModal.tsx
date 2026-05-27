import { useEffect, useState } from 'react';
import type {
  BootstrapConflictResolution,
  BootstrapImportResult,
  BootstrapRowResult,
  BootstrapStaleResolution,
  BootstrapStaleRow,
} from '@throughline/shared';
import { api } from '../api.js';
import { useModalRegistration } from '../keyboard/modalStack.js';

// Phase 20 — Slice 4 — bootstrap review surface (C-D20 surface 5).
//
// Shows two row classes:
//   * in-flight conflicts from a just-completed import — passed in via the
//     `lastImport` prop. The proposed-row payload comes from the file the
//     user just sent; the modal preserves it for take_theirs resolution.
//   * persistent stale rows — loaded from GET /api/projects/:id/import/conflicts
//     on open. Per T-D54 these are rows whose `bootstrap_id` dropped out of
//     a prior import; never auto-deleted.
//
// V1 carve-outs (documented in the slice handover):
//   * conflict action `merge_fields` — deferred; per-field UI not built.
//     v1 offers keep_mine (no-op) and take_theirs (apply proposed row).
//   * stale action `archive` — deferred; no archive surface exists in v1.
//     v1 offers keep (unflip bootstrap_stale) and delete (cascade-delete
//     the entity via service.delete).

export interface BootstrapReviewModalProps {
  open: boolean;
  projectId: string;
  // The result of the most-recent import call. The modal reads conflicts
  // from this (their proposed rows live in `lastImportFile.items` etc.).
  // Pass null when opening the modal for stale review only (e.g. from
  // the SettingsView entry block).
  lastImport: BootstrapImportResult | null;
  // The bootstrap file the user just submitted. Required to source the
  // proposed-row payload for take_theirs resolutions; passed alongside
  // `lastImport` from the calling surface.
  lastImportFile: BootstrapFile | null;
  onClose: () => void;
  onResolved?: () => void;
}

// Mirror of the producer-side bootstrap import file shape (T-D53). The modal
// reaches into this for take_theirs resolutions to surface the proposed row
// payload alongside the user's existing entity state.
export interface BootstrapFile {
  version: 1;
  items?: Array<{ bootstrap_id: string; source_type: string; [k: string]: unknown }>;
  sessions?: Array<{ bootstrap_id: string; source_type: string; [k: string]: unknown }>;
  library_entries?: Array<{ bootstrap_id: string; source_type: string; [k: string]: unknown }>;
}

type ConflictDecision = 'undecided' | 'keep_mine' | 'take_theirs';
type StaleDecision = 'undecided' | 'keep' | 'delete';

interface ConflictRowState {
  bootstrap_id: string;
  entity_type: 'item' | 'session' | 'library';
  entity_id: string;
  decision: ConflictDecision;
  proposed: Record<string, unknown> | null;
}

interface StaleRowState extends BootstrapStaleRow {
  decision: StaleDecision;
}

function findProposed(file: BootstrapFile | null, row: BootstrapRowResult): Record<string, unknown> | null {
  if (!file) return null;
  const section =
    row.entity_type === 'item' ? file.items : row.entity_type === 'session' ? file.sessions : file.library_entries;
  if (!section) return null;
  const match = section.find((r) => r.bootstrap_id === row.bootstrap_id);
  return (match as Record<string, unknown>) ?? null;
}

export function BootstrapReviewModal({
  open,
  projectId,
  lastImport,
  lastImportFile,
  onClose,
  onResolved,
}: BootstrapReviewModalProps) {
  useModalRegistration('bootstrap-review', open, onClose);
  const [conflicts, setConflicts] = useState<ConflictRowState[]>([]);
  const [stale, setStale] = useState<StaleRowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  // Tracks whether the modal has initialized its state for the current
  // open cycle. Guards against re-initialization (and the resulting loss
  // of user selections) when the parent re-renders with new prop refs
  // mid-edit — `lastImport` and `lastImportFile` are objects, so an
  // unmemoized parent would otherwise re-fire this effect on every
  // render. Resets to false when `open` goes back to false so the next
  // open cycle starts fresh.
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!open) {
      if (initialized) setInitialized(false);
      return;
    }
    if (initialized) return;
    setInitialized(true);
    // Seed conflicts from lastImport; load stale via GET endpoint.
    const conflictRows: ConflictRowState[] = (lastImport?.rows ?? [])
      .filter((r) => r.status === 'conflict' && r.entity_id !== null)
      .map((r) => ({
        bootstrap_id: r.bootstrap_id,
        entity_type: r.entity_type,
        entity_id: r.entity_id!,
        decision: 'undecided',
        proposed: findProposed(lastImportFile, r),
      }));
    setConflicts(conflictRows);
    setLoading(true);
    setError(null);
    api
      .listBootstrapConflicts(projectId)
      .then((res) => {
        setStale(res.result.stale.map((s) => ({ ...s, decision: 'undecided' })));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [open, projectId, lastImport, lastImportFile, initialized]);

  if (!open) return null;

  function setConflictDecision(idx: number, decision: ConflictDecision): void {
    setConflicts((prev) => prev.map((c, i) => (i === idx ? { ...c, decision } : c)));
  }

  function setStaleDecision(idx: number, decision: StaleDecision): void {
    setStale((prev) => prev.map((s, i) => (i === idx ? { ...s, decision } : s)));
  }

  async function apply(): Promise<void> {
    setApplying(true);
    setError(null);
    try {
      const conflictResolutions: BootstrapConflictResolution[] = conflicts
        .filter((c) => c.decision !== 'undecided')
        .map((c) => ({
          entity_type: c.entity_type,
          entity_id: c.entity_id,
          bootstrap_id: c.bootstrap_id,
          action: c.decision as 'keep_mine' | 'take_theirs',
          ...(c.decision === 'take_theirs' && c.proposed ? { proposed: c.proposed } : {}),
        }));
      const staleResolutions: BootstrapStaleResolution[] = stale
        .filter((s) => s.decision !== 'undecided')
        .map((s) => ({
          entity_type: s.entity_type,
          entity_id: s.entity_id,
          bootstrap_id: s.bootstrap_id,
          action: s.decision as 'keep' | 'delete',
        }));
      const res = await api.resolveBootstrap(projectId, {
        conflicts: conflictResolutions,
        stale: staleResolutions,
      });
      if (res.result.errors.length > 0) {
        setError(`resolved ${res.result.applied}, ${res.result.errors.length} errors: ${res.result.errors[0]?.message}`);
        return;
      }
      onResolved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Bootstrap review"
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel" style={{ maxWidth: 720 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Bootstrap review</h2>
          <button onClick={onClose} aria-label="close">×</button>
        </header>

        {loading && <p>Loading…</p>}
        {error && <p role="alert" style={{ color: 'crimson' }}>{error}</p>}

        <section>
          <h3>Conflicts ({conflicts.length})</h3>
          {conflicts.length === 0 && (
            <p style={{ color: '#666' }}>
              No in-flight conflicts. Re-run a bootstrap import to surface any new conflicts.
            </p>
          )}
          {conflicts.map((c, idx) => (
            <div key={`${c.entity_type}:${c.entity_id}`} style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <code>{c.bootstrap_id}</code>{' '}
                  <span style={{ color: '#666' }}>({c.entity_type})</span>
                </div>
                <div>
                  <label style={{ marginRight: 8 }}>
                    <input
                      type="radio"
                      name={`conflict-${idx}`}
                      checked={c.decision === 'keep_mine'}
                      onChange={() => setConflictDecision(idx, 'keep_mine')}
                    />{' '}
                    Keep mine
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`conflict-${idx}`}
                      checked={c.decision === 'take_theirs'}
                      onChange={() => setConflictDecision(idx, 'take_theirs')}
                      disabled={c.proposed === null}
                    />{' '}
                    Take theirs
                  </label>
                </div>
              </div>
              {c.proposed === null && c.decision !== 'keep_mine' && (
                <p style={{ color: '#888', fontSize: 12, margin: '4px 0 0' }}>
                  Proposed row not available (the import file is not attached); only "Keep mine" is selectable.
                </p>
              )}
            </div>
          ))}
        </section>

        <section style={{ marginTop: 16 }}>
          <h3>Stale rows ({stale.length})</h3>
          {stale.length === 0 && <p style={{ color: '#666' }}>None.</p>}
          {stale.map((s, idx) => (
            <div key={`${s.entity_type}:${s.entity_id}`} style={{ borderTop: '1px solid #eee', padding: '8px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <strong>{s.title}</strong>{' '}
                  <span style={{ color: '#666' }}>({s.entity_type})</span>
                  <br />
                  <code style={{ fontSize: 12 }}>{s.bootstrap_id}</code>
                </div>
                <div>
                  <label style={{ marginRight: 8 }}>
                    <input
                      type="radio"
                      name={`stale-${idx}`}
                      checked={s.decision === 'keep'}
                      onChange={() => setStaleDecision(idx, 'keep')}
                    />{' '}
                    Keep
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`stale-${idx}`}
                      checked={s.decision === 'delete'}
                      onChange={() => setStaleDecision(idx, 'delete')}
                    />{' '}
                    Delete
                  </label>
                </div>
              </div>
            </div>
          ))}
        </section>

        <footer style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={applying}>Cancel</button>
          <button onClick={apply} disabled={applying}>
            {applying ? 'Applying…' : 'Apply resolutions'}
          </button>
        </footer>
      </div>
    </div>
  );
}
