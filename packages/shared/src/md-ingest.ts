// Phase 6c — repo `.md` ingestion (SPEC §7.9; T-D11, T-D24, T-D29, T-D36).
// Folder-opt-in: the user points the backend at directories *inside the project's
// repo_path*; the backend scans them for `.md` files and ingests selected ones as
// `imported_doc` library entries with an AI-generated summary + tag suggestions.
// Re-ingest is snapshot-by-default with a per-entry "track source" toggle (§13 adopted
// default) — tracked entries re-ingest (and re-summarise) when the file changes on disk.

export interface MdIngestFolder {
  id: string;
  project_id: string;
  rel_path: string; // relative to the project's repo_path
  created_at: string;
}

export type MdScanStatus = 'new' | 'changed' | 'unchanged';

export interface MdScanCandidate {
  rel_path: string; // relative to repo_path (stable identifier for ingest selection)
  size: number;
  status: MdScanStatus;
  entry_id: string | null; // existing imported-doc entry when status != 'new'
}

export interface MdScanResult {
  folder_id: string;
  candidates: MdScanCandidate[];
  truncated: boolean;
}

export interface MdIngestRequest {
  folder_id: string;
  paths: string[]; // rel_paths from a prior scan the user chose to ingest
}

export interface MdIngestedEntrySummary {
  entry_id: string;
  rel_path: string;
  status: 'created' | 'reingested';
  // Disclosed when the AI summariser degraded to the heuristic (no key, unparseable AI
  // output, or a failed call); null when the AI summary was used. Mirrors the dump-zone /
  // reconcile `extractor_note` twins so an AI summary-failure is not silently presented as a
  // healthy summary (T-D60, SF4-02).
  extractor_note: string | null;
}

// Why a selected file was not ingested — a typed reason, not a flat string, so a deleted /
// too-large / unreadable / out-of-bounds skip is no longer conflated into one bucket the
// caller can't tell apart (SF4-03).
export type MdSkipReason =
  | 'outside_repo' // path escaped repo_path (lexical containment / `..` escape)
  | 'outside_folder' // resolved outside the scanned folder
  | 'missing' // no longer exists on disk (deleted between scan and ingest)
  | 'symlink' // reachable only by traversing a symlink (C-D10 TOCTOU guard)
  | 'too_large' // exceeds the max ingest size
  | 'unreadable'; // read failed (permissions, decode, …)

export interface MdSkippedFile {
  rel_path: string;
  reason: MdSkipReason;
}

export interface MdIngestResult {
  ingested: MdIngestedEntrySummary[];
  skipped: MdSkippedFile[];
}

export interface MdTrackRequest {
  tracked: boolean;
}
