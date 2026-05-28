// Phase 20 — bootstrap import file ingest types (T-D53, T-D54, C-D20).
// Shared between backend and frontend. The runtime backend service in
// `packages/backend/src/bootstrap/service.ts` exports its own definitions
// (the source of truth); these mirrors carry the request/response shape
// across the wire.

export type BootstrapEntityType = 'item' | 'session' | 'library';
export type BootstrapRowStatus = 'new' | 'reimported' | 'conflict' | 'stale_flagged';

export interface BootstrapRowResult {
  bootstrap_id: string;
  entity_type: BootstrapEntityType;
  entity_id: string | null;
  status: BootstrapRowStatus;
  reason?: string;
}

export interface BootstrapImportCounts {
  new: number;
  reimported: number;
  conflict: number;
  stale_flagged: number;
}

export interface BootstrapImportResult {
  project_id: string;
  rows: BootstrapRowResult[];
  counts: BootstrapImportCounts;
}

export interface BootstrapStaleRow {
  entity_type: BootstrapEntityType;
  entity_id: string;
  bootstrap_id: string;
  title: string;
}

export interface BootstrapListConflictsResult {
  project_id: string;
  stale: BootstrapStaleRow[];
}

export type BootstrapConflictAction = 'keep_mine' | 'take_theirs';
export type BootstrapStaleAction = 'keep' | 'delete';

export interface BootstrapConflictResolution {
  entity_type: BootstrapEntityType;
  entity_id: string;
  bootstrap_id: string;
  action: BootstrapConflictAction;
  proposed?: unknown;
  source_type?: string;
}

export interface BootstrapStaleResolution {
  entity_type: BootstrapEntityType;
  entity_id: string;
  bootstrap_id: string;
  action: BootstrapStaleAction;
}

export interface BootstrapResolveResult {
  applied: number;
  noop: number;
  errors: Array<{ entity_id: string; message: string }>;
}

// Phase 21 — bootstrap render endpoint return (C-D21 surface 2).
export interface BootstrapRenderResult {
  promptPath: string;
  outputPath: string;
  bundlePath: string;
  invocationCommand: string;
}

// Phase 21 — GET /api/projects/:id/bootstrap/state response (C-D21 surface 4).
export interface BootstrapStateLastIngest {
  at: string;
  counts: BootstrapImportCounts;
}

export interface BootstrapState {
  throughlineDir: 'absent' | 'present';
  promptRendered: boolean;
  pendingOutput: boolean;
  lastIngest: BootstrapStateLastIngest | null;
  archiveCount: number;
  quarantineCount: number;
  promptPath: string | null;
  outputPath: string | null;
}
