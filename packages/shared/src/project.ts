export type ProjectState = 'active' | 'archived';

export interface Project {
  id: string;
  name: string;
  repo_path: string;
  github_owner: string | null;
  github_repo: string | null;
  bundle_id: string;
  // C-D14 — when set, the bundle loader resolves `<bundle_path>/bundle.md`
  // instead of the install-shipped `methodologies/<bundle_id>/bundle.md`.
  bundle_path: string | null;
  state: ProjectState;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CreateProjectInput {
  name: string;
  repo_path: string;
  bundle_id?: string;
  bundle_path?: string | null;
  github_owner?: string;
  github_repo?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  name?: string;
  repo_path?: string;
  // Phase 15 — the settings panel exposes the per-project methodology bundle binding
  // (SPEC §7.25). Rebinding re-registers any external bundle watch and is audit-logged.
  bundle_id?: string;
  bundle_path?: string | null;
  github_owner?: string | null;
  github_repo?: string | null;
  state?: ProjectState;
  settings?: Record<string, unknown>;
  // C-D19 surface 7 — when true, the backend re-reads `.throughline/project.json`
  // from the project's persisted repo_path and applies the fields it supplies
  // (T-D52 single-write-path discipline). Explicit fields in this same update
  // body override the file. Never persisted; control flag only.
  reinit_throughline?: boolean;
}
