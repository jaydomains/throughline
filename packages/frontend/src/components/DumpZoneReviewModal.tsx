import { useEffect, useMemo, useState } from 'react';
import type {
  DumpZoneProposal,
  ProposalPayload,
  ProposedItem,
  ProposedLibraryEntry,
  Session,
} from '@throughline/shared';
import { api } from '../api.js';
import { useModalRegistration } from '../keyboard/modalStack.js';

// Dump zone review modal (T-D5, §7.6). Renders the proposed payload returned by the backend
// extractor and lets the user:
//   - edit title / type / status / target session / tags on each item before apply
//   - flip a "discard" toggle per row (defaults to keep)
//   - cross-session re-route via the session dropdown
//   - cancel (deletes the pending proposal) or apply
//
// Cross-session re-route per CHECKLIST §Phase 4 "Review modal shows proposed-items +
// cross-session re-route option": each item row has a "target session" select drawn from
// the project's sessions.

interface ItemPolicySummary {
  types: string[];
  statuses: string[];
}

export interface DumpZoneReviewModalProps {
  open: boolean;
  proposal: DumpZoneProposal | null;
  projectId: string;
  policy: ItemPolicySummary;
  sessions: Session[];
  onClose: () => void;
  onApplied: (appliedItemIds: string[], appliedLibraryEntryIds: string[]) => void;
}

interface SessionRowEdit extends ProposedItem {
  discarded: boolean;
}

interface LibraryRowEdit extends ProposedLibraryEntry {
  discarded: boolean;
}

export function DumpZoneReviewModal({
  open,
  proposal,
  projectId,
  policy,
  sessions,
  onClose,
  onApplied,
}: DumpZoneReviewModalProps) {
  useModalRegistration('dump-zone-review', open, onClose);
  const [sessionRows, setSessionRows] = useState<SessionRowEdit[]>([]);
  const [libraryRows, setLibraryRows] = useState<LibraryRowEdit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open || !proposal) return;
    setSessionRows(
      proposal.payload.items.map((it) => ({ ...it, discarded: false })),
    );
    setLibraryRows(
      proposal.payload.library.map((e) => ({ ...e, discarded: false })),
    );
    setError(null);
    setApplying(false);
  }, [open, proposal]);

  const totalKeep = useMemo(
    () => sessionRows.filter((r) => !r.discarded).length + libraryRows.filter((r) => !r.discarded).length,
    [sessionRows, libraryRows],
  );

  if (!open || !proposal) return null;

  async function cancel() {
    if (!proposal) return;
    try {
      await api.discardProposal(projectId, proposal.id);
    } catch {
      // Discard failures are non-fatal — the proposal will just remain as 'pending' in the
      // database. Worst case the user can apply or discard it later from a hypothetical
      // "open proposals" surface (none today; flagged for Phase 14 hygiene queries).
    }
    onClose();
  }

  async function apply() {
    if (!proposal || applying) return;
    setApplying(true);
    setError(null);
    const decisions: Record<string, 'keep' | 'discard'> = {};
    const payload: ProposalPayload = {
      target: proposal.payload.target,
      source: proposal.payload.source,
      extractor: proposal.payload.extractor,
      items: sessionRows.map(({ discarded: _d, ...rest }) => {
        if (_d) decisions[rest.proposal_item_id] = 'discard';
        return rest;
      }),
      library: libraryRows.map(({ discarded: _d, ...rest }) => {
        if (_d) decisions[rest.proposal_item_id] = 'discard';
        return rest;
      }),
      clarifying_questions: proposal.payload.clarifying_questions,
      suggested_session_id: proposal.payload.suggested_session_id,
      extractor_note: proposal.payload.extractor_note,
    };
    try {
      const r = await api.applyDumpZone(projectId, {
        proposal_id: proposal.id,
        payload,
        decisions,
      });
      setApplying(false);
      onApplied(r.result.applied_item_ids, r.result.applied_library_entry_ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setApplying(false);
    }
  }

  function updateSessionRow(idx: number, patch: Partial<SessionRowEdit>) {
    setSessionRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function updateLibraryRow(idx: number, patch: Partial<LibraryRowEdit>) {
    setLibraryRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-label="Review dump zone proposal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal dump-zone-modal" data-testid="dump-zone-review-modal">
        <h2 style={{ marginTop: 0 }}>Review proposed items</h2>
        <p className="form-hint">
          Extractor: {proposal.payload.extractor === 'anthropic' ? 'AI (Anthropic)' : 'Heuristic'} —{' '}
          {sessionRows.length} item{sessionRows.length === 1 ? '' : 's'},{' '}
          {libraryRows.length} library entr{libraryRows.length === 1 ? 'y' : 'ies'}.
        </p>
        {proposal.payload.extractor_note && (
          <p className="form-hint" data-testid="dump-zone-extractor-note">
            {proposal.payload.extractor_note}
          </p>
        )}
        {proposal.payload.clarifying_questions.length > 0 && (
          <div className="clarifying">
            <strong>Clarifying questions:</strong>
            <ul>
              {proposal.payload.clarifying_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}
        {proposal.payload.target === 'session' && (
          <table className="proposal-table" data-testid="dump-zone-session-rows">
            <thead>
              <tr>
                <th>Keep</th>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Session</th>
              </tr>
            </thead>
            <tbody>
              {sessionRows.map((r, i) => (
                <tr key={r.proposal_item_id} data-testid={`dump-zone-row-${i}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!r.discarded}
                      onChange={(e) => updateSessionRow(i, { discarded: !e.target.checked })}
                      aria-label="Keep this item"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.title}
                      onChange={(e) => updateSessionRow(i, { title: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={r.type}
                      onChange={(e) => updateSessionRow(i, { type: e.target.value })}
                    >
                      {policy.types.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={r.status}
                      onChange={(e) => updateSessionRow(i, { status: e.target.value })}
                    >
                      {policy.statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={r.target_session_id ?? ''}
                      onChange={(e) =>
                        updateSessionRow(i, {
                          target_session_id: e.target.value === '' ? null : e.target.value,
                        })
                      }
                      data-testid={`dump-zone-row-${i}-session`}
                    >
                      <option value="">(no session)</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {sessionRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="form-hint">
                    No items extracted.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {proposal.payload.target === 'library' && (
          <table className="proposal-table" data-testid="dump-zone-library-rows">
            <thead>
              <tr>
                <th>Keep</th>
                <th>Title</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {libraryRows.map((r, i) => (
                <tr key={r.proposal_item_id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!r.discarded}
                      onChange={(e) => updateLibraryRow(i, { discarded: !e.target.checked })}
                      aria-label="Keep this entry"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.title}
                      onChange={(e) => updateLibraryRow(i, { title: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={r.type}
                      onChange={(e) =>
                        updateLibraryRow(i, {
                          type: e.target.value as ProposedLibraryEntry['type'],
                        })
                      }
                    >
                      <option value="note">note</option>
                      <option value="prompt">prompt</option>
                      <option value="snippet">snippet</option>
                      <option value="imported_doc">imported_doc</option>
                    </select>
                  </td>
                </tr>
              ))}
              {libraryRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="form-hint">
                    No library entries extracted.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
            disabled={applying || totalKeep === 0}
            data-testid="dump-zone-apply"
          >
            {applying ? 'Applying…' : `Apply (${totalKeep})`}
          </button>
        </div>
      </div>
    </div>
  );
}
