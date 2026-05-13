// Phase 4 — capture surfaces (SPEC §7.6; T-D5, T-D16, T-D20, T-D37).
// Shared types span the dump-zone proposal contract (paste/voice/inbox/code-todo all funnel
// through one extraction → review modal pathway), scratchpad jots, inbox queue rows, and
// minimal library entries (library UI lands in Phase 6; capture only needs create + list).

export type ProposalSource = 'paste' | 'voice' | 'inbox' | 'code_todo';
export type ProposalTarget = 'session' | 'library';
export type ProposalStatus = 'pending' | 'applied' | 'discarded';
export type ExtractorKind = 'anthropic' | 'heuristic';

// One proposed item inside a pending extraction. The dump zone review modal lets the user
// edit any of these fields before apply. Per SPEC §7.6, the modal must support cross-session
// re-route — captured here as the target_session_id field, defaulting to whatever extraction
// suggested (or the session the dump zone was opened from).
export interface ProposedItem {
  // Stable across a single extraction lifecycle so the modal can keep selection state.
  proposal_item_id: string;
  type: string; // bundle-allowed item type, validated again at apply time
  status: string; // bundle-allowed item status
  title: string;
  description: string;
  tags: string[];
  target_session_id: string | null;
  // Optional code reference surfaced by the code-TODO scanner (file:line). Read-only in v1.
  code_ref?: { path: string; line: number };
  // Confidence is null for heuristic; a 0..1 score when the AI extractor returns one.
  confidence: number | null;
}

export interface ProposedLibraryEntry {
  proposal_item_id: string;
  type: 'note' | 'prompt' | 'snippet' | 'imported_doc';
  title: string;
  body: string;
  tags: string[];
}

// Bundle-aware extraction returns a single envelope regardless of source. The review modal
// reads this; apply consumes a (possibly user-edited) version of it.
export interface ProposalPayload {
  target: ProposalTarget;
  source: ProposalSource;
  extractor: ExtractorKind;
  items: ProposedItem[]; // empty when target='library'
  library: ProposedLibraryEntry[]; // empty when target='session'
  clarifying_questions: string[];
  suggested_session_id: string | null;
  // Diagnostic from the AI/heuristic path so the UI can show "AI" vs "heuristic" badge.
  extractor_note: string | null;
}

export interface DumpZoneProposal {
  id: string;
  project_id: string;
  target: ProposalTarget;
  source: ProposalSource;
  extractor: ExtractorKind;
  raw_text: string;
  payload: ProposalPayload;
  status: ProposalStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface ProposeRequest {
  text: string;
  target: ProposalTarget;
  source: ProposalSource;
  session_id?: string | null; // when target='session': seed for routing suggestion
}

// User-edited payload at apply time. Server re-validates against bundle policy before
// inserting items / library entries.
export interface ApplyRequest {
  proposal_id: string;
  payload: ProposalPayload;
  // Per item: keep or discard. Defaults to keep when omitted.
  decisions?: Record<string, 'keep' | 'discard'>;
}

export interface ApplyResult {
  applied_item_ids: string[];
  applied_library_entry_ids: string[];
}

// Scratchpad — friction-free jots. No AI, no review. Per T-D20.
export interface ScratchpadJot {
  id: string;
  project_id: string | null;
  body: string;
  created_at: string;
}

export interface CreateScratchpadJotInput {
  project_id: string | null;
  body: string;
}

// Library — Phase 6 owns the full surface, but the library dump zone in Phase 4 needs to
// create/list entries. Update / delete / attach-to-item / search land in Phase 6.
export type LibraryEntryType = 'note' | 'prompt' | 'snippet' | 'imported_doc';

export interface LibraryEntry {
  id: string;
  project_id: string;
  type: LibraryEntryType;
  title: string;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateLibraryEntryInput {
  project_id: string;
  type: LibraryEntryType;
  title: string;
  body?: string;
  tags?: string[];
}

// Claude Code inbox (T-D16, T-D37). Status reflects worker state, not user state.
export type InboxQueueState = 'queued' | 'processed' | 'failed';

export interface InboxQueueEntry {
  id: string;
  original_path: string;
  received_at: string;
  state: InboxQueueState;
  error_text: string | null;
}

export interface InboxStatusSummary {
  queued: number;
  processed_recent: number;
  failed_recent: number;
}

// Code TODO/FIXME scan — manual trigger per §7.6.
export interface CodeTodoScanRequest {
  patterns?: string[]; // defaults to ['TODO:', 'FIXME:', 'XXX:'] per §13 adoption
}

export interface CodeTodoScanResult {
  scan_id: string;
  proposal_id: string;
  match_count: number;
}
