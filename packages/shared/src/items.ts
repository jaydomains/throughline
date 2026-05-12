// Items per SPEC §7.4 and T-D1 / T-D8 / T-D38.
// Type and status come from the project's bundle (freeform: type='task', statuses=['open','done']).

export interface Item {
  id: string;
  project_id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  blocker_text: string | null;
  parent_id: string | null;
  branch_ref: string | null;
  tags: string[];
  blockers: string[]; // structured blocker references — item ids that block this one (T-D8)
  session_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateItemInput {
  project_id: string;
  type?: string; // defaults to the bundle's first declared type
  title: string;
  description?: string;
  status?: string; // defaults to the bundle's first declared status
  blocker_text?: string;
  parent_id?: string | null;
  branch_ref?: string | null;
  tags?: string[];
  session_ids?: string[];
}

export interface UpdateItemInput {
  type?: string;
  title?: string;
  description?: string;
  status?: string;
  blocker_text?: string | null;
  parent_id?: string | null;
  branch_ref?: string | null;
}

export interface Board {
  id: string;
  label: string;
  type: string;
}

export interface ItemPolicy {
  bundle_id: string;
  types: string[];
  statuses: string[];
  boards: Board[];
}
