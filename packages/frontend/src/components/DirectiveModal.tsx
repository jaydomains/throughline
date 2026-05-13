import { useEffect, useState } from 'react';
import {
  DIRECTIVE_KINDS,
  REMINDER_UNITS,
  type Directive,
  type DirectiveKind,
  type DirectiveParentType,
  type DirectivePayload,
  type ReminderPayload,
  type ReminderUnit,
} from '@throughline/shared';
import { api } from '../api.js';
import { useModalRegistration } from '../keyboard/modalStack.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (directive: Directive) => void;
  projectId: string;
  parentType: DirectiveParentType;
  parentId: string;
  parentTitle: string;
  // When set, the modal edits this directive; when null, it creates one.
  existing: Directive | null;
}

// Phase 6b — directive create/edit modal (SPEC §7.10, T-D12).
// Three kinds: pin (no extra fields), reminder (absolute or relative spec, optional
// recurrence + note), include_prompt (optional editorial note). The reminder field set
// mirrors `parseRelativeReminder`'s grammar — the form-level error surfaces when the
// backend rejects an unrecognised spec.
export function DirectiveModal({
  open,
  onClose,
  onSaved,
  projectId,
  parentType,
  parentId,
  parentTitle,
  existing,
}: Props) {
  useModalRegistration('directive', open, onClose);

  const [kind, setKind] = useState<DirectiveKind>('pin');
  const [reminderMode, setReminderMode] = useState<'absolute' | 'relative'>('absolute');
  const [reminderAbsolute, setReminderAbsolute] = useState<string>('');
  const [reminderRelative, setReminderRelative] = useState<string>('in 1 day');
  const [recurrenceOn, setRecurrenceOn] = useState(false);
  const [recurrenceEvery, setRecurrenceEvery] = useState<number>(1);
  const [recurrenceUnit, setRecurrenceUnit] = useState<ReminderUnit>('day');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setKind(existing.kind);
      setError(null);
      const payload = existing.payload as Partial<ReminderPayload>;
      if (existing.kind === 'reminder') {
        const mode = payload.mode === 'relative' ? 'relative' : 'absolute';
        setReminderMode(mode);
        if (mode === 'absolute' && typeof payload.fire_at === 'string' && payload.fire_at) {
          // datetime-local needs YYYY-MM-DDTHH:MM in local time. Render in UTC for stability.
          const d = new Date(payload.fire_at);
          if (!Number.isNaN(d.getTime())) {
            setReminderAbsolute(d.toISOString().slice(0, 16));
          }
        }
        if (mode === 'relative') {
          setReminderRelative(payload.relative_spec ?? '');
        }
        if (payload.recurrence) {
          setRecurrenceOn(true);
          setRecurrenceEvery(payload.recurrence.every);
          setRecurrenceUnit(payload.recurrence.unit);
        } else {
          setRecurrenceOn(false);
        }
        setNote(payload.note ?? '');
      } else if (existing.kind === 'include_prompt') {
        setNote((payload as { note?: string }).note ?? '');
      }
    } else {
      setKind('pin');
      setReminderMode('absolute');
      setReminderAbsolute('');
      setReminderRelative('in 1 day');
      setRecurrenceOn(false);
      setRecurrenceEvery(1);
      setRecurrenceUnit('day');
      setNote('');
      setError(null);
    }
  }, [open, existing]);

  if (!open) return null;

  function buildPayload(): DirectivePayload {
    if (kind === 'pin') return {};
    if (kind === 'include_prompt') return note ? { note } : {};
    // reminder
    const base: ReminderPayload = { mode: reminderMode, fire_at: '' };
    if (reminderMode === 'absolute') {
      if (!reminderAbsolute) {
        throw new Error('Pick a date and time for the absolute reminder.');
      }
      const d = new Date(reminderAbsolute);
      if (Number.isNaN(d.getTime())) {
        throw new Error('Invalid absolute timestamp.');
      }
      base.fire_at = d.toISOString();
    } else {
      base.relative_spec = reminderRelative.trim();
    }
    if (recurrenceOn) {
      base.recurrence = { every: recurrenceEvery, unit: recurrenceUnit };
    }
    if (note) base.note = note;
    return base;
  }

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload();
      const result = existing
        ? await api.updateDirective(projectId, existing.id, { payload })
        : await api.createDirective(projectId, {
            parent_type: parentType,
            parent_id: parentId,
            kind,
            payload,
          });
      onSaved(result.directive);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const title = existing ? `Edit directive · ${parentTitle}` : `Add directive · ${parentTitle}`;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal directive-modal" data-testid="directive-modal">
        <h2 style={{ marginTop: 0 }}>{title}</h2>

        <label className="form-row">
          <span>Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DirectiveKind)}
            disabled={existing !== null}
            data-testid="directive-kind"
          >
            {DIRECTIVE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k === 'include_prompt' ? 'include in session prompt' : k}
              </option>
            ))}
          </select>
        </label>

        {kind === 'pin' && (
          <p className="form-hint">
            Pin sticks this {parentType === 'item' ? 'item' : 'library entry'} to the top of its
            parent view (session board or library sidebar in Phase 6).
          </p>
        )}

        {kind === 'reminder' && (
          <>
            <label className="form-row">
              <span>Mode</span>
              <select
                value={reminderMode}
                onChange={(e) => setReminderMode(e.target.value as 'absolute' | 'relative')}
                data-testid="directive-reminder-mode"
              >
                <option value="absolute">absolute (date + time)</option>
                <option value="relative">relative (in N days / tomorrow HH:MM)</option>
              </select>
            </label>
            {reminderMode === 'absolute' ? (
              <label className="form-row">
                <span>Fire at</span>
                <input
                  type="datetime-local"
                  value={reminderAbsolute}
                  onChange={(e) => setReminderAbsolute(e.target.value)}
                  data-testid="directive-reminder-absolute"
                />
              </label>
            ) : (
              <label className="form-row">
                <span>Spec</span>
                <input
                  type="text"
                  value={reminderRelative}
                  onChange={(e) => setReminderRelative(e.target.value)}
                  placeholder="in 3 days · in 2 hours · tomorrow 09:00"
                  data-testid="directive-reminder-relative"
                />
              </label>
            )}
            <label className="form-row">
              <span>Recurring</span>
              <span>
                <input
                  type="checkbox"
                  checked={recurrenceOn}
                  onChange={(e) => setRecurrenceOn(e.target.checked)}
                  data-testid="directive-recurrence-on"
                />{' '}
                repeat every{' '}
                <input
                  type="number"
                  min={1}
                  value={recurrenceEvery}
                  disabled={!recurrenceOn}
                  onChange={(e) => setRecurrenceEvery(Number(e.target.value) || 1)}
                  style={{ width: '4em' }}
                  data-testid="directive-recurrence-every"
                />{' '}
                <select
                  value={recurrenceUnit}
                  disabled={!recurrenceOn}
                  onChange={(e) => setRecurrenceUnit(e.target.value as ReminderUnit)}
                  data-testid="directive-recurrence-unit"
                >
                  {REMINDER_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="form-row">
              <span>Note</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="optional — shown in the OS notification body"
                data-testid="directive-note"
              />
            </label>
          </>
        )}

        {kind === 'include_prompt' && (
          <>
            <p className="form-hint">
              Flagged items auto-prepend to the generated session-start prompt (Phase 13 wires
              the actual assembly; 6b records the directive today).
            </p>
            <label className="form-row">
              <span>Note</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="optional — editorial guidance"
                data-testid="directive-note"
              />
            </label>
          </>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={submitting}
            onClick={() => void save()}
            data-testid="directive-save"
          >
            {submitting ? 'Saving…' : existing ? 'Save changes' : 'Add directive'}
          </button>
        </div>
      </div>
    </div>
  );
}
