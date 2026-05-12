// Sessions per SPEC §7.3 and T-D1 — saved views over the per-project item pool.

export interface Session {
  id: string;
  project_id: string;
  name: string;
  branch_ref: string | null;
  context: string | null;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateSessionInput {
  project_id: string;
  name: string;
  branch_ref?: string | null;
  context?: string | null;
  settings?: Record<string, unknown>;
}

export interface UpdateSessionInput {
  name?: string;
  branch_ref?: string | null;
  context?: string | null;
  settings?: Record<string, unknown>;
}
