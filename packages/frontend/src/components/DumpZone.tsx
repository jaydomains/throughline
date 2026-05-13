import { useRef, useState } from 'react';
import type { DumpZoneProposal, ProposalTarget, ItemPolicy, Session } from '@throughline/shared';
import { api } from '../api.js';
import { DumpZoneReviewModal } from './DumpZoneReviewModal.js';
import { VoiceCapture } from './VoiceCapture.js';

// Dump zone capture surface. Accepts paste (textarea) + file drop. Submitting calls
// /dump-zone/propose, opens the review modal with the returned proposal.

interface DumpZoneProps {
  projectId: string;
  target: ProposalTarget;
  policy: Pick<ItemPolicy, 'types' | 'statuses'>;
  sessions: Session[];
  defaultSessionId?: string | null;
  onApplied?: (itemIds: string[], libraryIds: string[]) => void;
  enableVoice?: boolean;
}

export function DumpZone({
  projectId,
  target,
  policy,
  sessions,
  defaultSessionId,
  onApplied,
  enableVoice = true,
}: DumpZoneProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Pre-voice text snapshot. Speech recognition streams cumulative interim transcripts —
  // each onTranscript carries the full utterance so far, not a delta. Appending each update
  // would duplicate. Convention: when an external input source streams interim updates into
  // an existing text field, snapshot the pre-update state and treat incoming updates as
  // authoritative replacements of the streamed portion.
  const preVoiceTextRef = useRef<string | null>(null);
  const [proposal, setProposal] = useState<DumpZoneProposal | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function propose(source: 'paste' | 'voice', overrideText?: string) {
    const value = (overrideText ?? text).trim();
    if (value.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.proposeDumpZone(projectId, {
        text: value,
        target,
        source,
        session_id: defaultSessionId ?? null,
      });
      setProposal(r.proposal);
      setReviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
  }

  return (
    <div className="dump-zone" data-testid="dump-zone">
      <h3>Dump zone — {target === 'session' ? 'session' : 'library'}</h3>
      <div
        className="dump-zone-dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => void onFileDrop(e)}
        data-testid="dump-zone-drop"
      >
        <textarea
          aria-label="Dump zone input"
          placeholder="Paste text here, or drop a text file. AI extracts items on submit."
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-testid="dump-zone-textarea"
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="primary"
          disabled={submitting || text.trim().length === 0}
          onClick={() => void propose('paste')}
          data-testid="dump-zone-submit"
        >
          {submitting ? 'Extracting…' : 'Extract'}
        </button>
        {enableVoice && (
          <VoiceCapture
            onStart={() => {
              preVoiceTextRef.current = text;
            }}
            onTranscript={(transcript) => {
              const base = preVoiceTextRef.current;
              if (base === null) {
                setText(transcript);
                return;
              }
              setText(base.length > 0 ? `${base}\n\n${transcript}` : transcript);
            }}
            onSubmit={(transcript) => {
              preVoiceTextRef.current = null;
              void propose('voice', transcript);
            }}
            onCancel={() => {
              preVoiceTextRef.current = null;
            }}
          />
        )}
        <button
          type="button"
          onClick={() => setText('')}
          disabled={submitting || text.length === 0}
        >
          Clear
        </button>
      </div>
      <DumpZoneReviewModal
        open={reviewOpen}
        proposal={proposal}
        projectId={projectId}
        policy={policy}
        sessions={sessions}
        onClose={() => {
          setReviewOpen(false);
          setProposal(null);
        }}
        onApplied={(itemIds, libraryIds) => {
          setReviewOpen(false);
          setProposal(null);
          setText('');
          onApplied?.(itemIds, libraryIds);
        }}
      />
    </div>
  );
}
