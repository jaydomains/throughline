import type {
  ApplyRequest,
  ApplyResult,
  AttachedItemSummary,
  AuditEntry,
  CodeTodoScanResult,
  CreateItemInput,
  CreateLibraryEntryInput,
  CreateProjectInput,
  CreateSessionInput,
  DumpZoneProposal,
  InboxQueueEntry,
  InboxStatusSummary,
  Item,
  ItemPolicy,
  LibraryEntry,
  LibraryEntryType,
  LibrarySearchRequest,
  LibrarySearchResult,
  Project,
  PromptFillRequest,
  PromptFillResult,
  ProposeRequest,
  ReconcileApplyRequest,
  ReconcileApplyResult,
  ReconcileProposeRequest,
  ReconcileRun,
  ScratchpadJot,
  Session,
  UpdateItemInput,
  UpdateLibraryEntryInput,
  UpdateSessionInput,
} from '@throughline/shared';

export interface MethodologySummary {
  status: 'loaded' | 'error';
  bundle_id: string;
  identity?: { name: string; version: string; authority_precedence: string[] };
  errors?: Array<{ bundle_id: string; section?: string; message: string }>;
  // Phase 2 needs to know whether the bundle declares a primary unit (modules view) and
  // whether it declares any gates (methodology-gates view) so the toggle can hide them.
  has_primary_unit?: boolean;
  has_gates?: boolean;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

function pid(projectId: string): string {
  return encodeURIComponent(projectId);
}

export const api = {
  health: () => jsonFetch<{ ok: boolean; version: string }>('/health'),
  listProjects: () => jsonFetch<{ projects: Project[] }>('/api/projects'),
  createProject: (input: CreateProjectInput) =>
    jsonFetch<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listMethodologies: () =>
    jsonFetch<{ methodologies: MethodologySummary[] }>('/api/methodologies'),
  switchProject: (id: string) =>
    jsonFetch<{ ok: true }>(`/api/projects/${pid(id)}/switch`, { method: 'POST' }),
  getSettings: () => jsonFetch<{ settings: Record<string, unknown> }>('/api/settings'),

  getPolicy: (projectId: string) =>
    jsonFetch<{ policy: ItemPolicy }>(`/api/projects/${pid(projectId)}/policy`),

  listSessions: (projectId: string) =>
    jsonFetch<{ sessions: Session[] }>(`/api/projects/${pid(projectId)}/sessions`),
  createSession: (projectId: string, input: Omit<CreateSessionInput, 'project_id'>) =>
    jsonFetch<{ session: Session }>(`/api/projects/${pid(projectId)}/sessions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateSession: (projectId: string, sessionId: string, input: UpdateSessionInput) =>
    jsonFetch<{ session: Session }>(
      `/api/projects/${pid(projectId)}/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
  deleteSession: (projectId: string, sessionId: string) =>
    fetch(`/api/projects/${pid(projectId)}/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(`DELETE session failed: ${r.status}`);
    }),

  listItems: (
    projectId: string,
    opts?: { session_id?: string; parent_id?: string | null },
  ) => {
    const params = new URLSearchParams();
    if (opts?.session_id) params.set('session_id', opts.session_id);
    if (opts?.parent_id === null) params.set('parent_id', 'null');
    else if (opts?.parent_id) params.set('parent_id', opts.parent_id);
    const qs = params.toString();
    return jsonFetch<{ items: Item[] }>(
      `/api/projects/${pid(projectId)}/items${qs ? `?${qs}` : ''}`,
    );
  },
  getItem: (projectId: string, itemId: string) =>
    jsonFetch<{ item: Item }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}`,
    ),
  createItem: (projectId: string, input: Omit<CreateItemInput, 'project_id'>) =>
    jsonFetch<{ item: Item }>(`/api/projects/${pid(projectId)}/items`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateItem: (projectId: string, itemId: string, input: UpdateItemInput) =>
    jsonFetch<{ item: Item }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
  deleteItem: (projectId: string, itemId: string) =>
    fetch(`/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(`DELETE item failed: ${r.status}`);
    }),
  addItemTag: (projectId: string, itemId: string, tag: string) =>
    jsonFetch<{ item: Item }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/tags`,
      { method: 'POST', body: JSON.stringify({ tag }) },
    ),
  removeItemTag: (projectId: string, itemId: string, tag: string) =>
    jsonFetch<{ item: Item }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/tags/${encodeURIComponent(tag)}`,
      { method: 'DELETE' },
    ),
  addItemBlocker: (projectId: string, itemId: string, blockedById: string) =>
    jsonFetch<{ item: Item }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/blockers`,
      { method: 'POST', body: JSON.stringify({ blocked_by_item_id: blockedById }) },
    ),
  removeItemBlocker: (projectId: string, itemId: string, blockedById: string) =>
    jsonFetch<{ item: Item }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/blockers/${encodeURIComponent(blockedById)}`,
      { method: 'DELETE' },
    ),
  addItemSessionMembership: (projectId: string, itemId: string, sessionId: string) =>
    jsonFetch<{ item: Item }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'POST' },
    ),
  removeItemSessionMembership: (projectId: string, itemId: string, sessionId: string) =>
    jsonFetch<{ item: Item }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
    ),

  // Phase 4 — capture surfaces.
  proposeDumpZone: (projectId: string, input: ProposeRequest) =>
    jsonFetch<{ proposal: DumpZoneProposal }>(
      `/api/projects/${pid(projectId)}/dump-zone/propose`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  applyDumpZone: (projectId: string, input: ApplyRequest) =>
    jsonFetch<{ result: ApplyResult }>(
      `/api/projects/${pid(projectId)}/dump-zone/apply`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  getProposal: (projectId: string, proposalId: string) =>
    jsonFetch<{ proposal: DumpZoneProposal }>(
      `/api/projects/${pid(projectId)}/dump-zone/proposals/${encodeURIComponent(proposalId)}`,
    ),
  discardProposal: (projectId: string, proposalId: string) =>
    fetch(`/api/projects/${pid(projectId)}/dump-zone/proposals/${encodeURIComponent(proposalId)}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(`DELETE proposal failed: ${r.status}`);
    }),

  listLibrary: (projectId: string, opts?: { type?: LibraryEntryType; scope?: 'project' | 'global' }) => {
    const params = new URLSearchParams();
    if (opts?.type) params.set('type', opts.type);
    if (opts?.scope === 'global') params.set('scope', 'global');
    const qs = params.toString();
    return jsonFetch<{ entries: LibraryEntry[] }>(
      `/api/projects/${pid(projectId)}/library${qs ? `?${qs}` : ''}`,
    );
  },
  getLibraryEntry: (projectId: string, entryId: string) =>
    jsonFetch<{ entry: LibraryEntry }>(
      `/api/projects/${pid(projectId)}/library/${encodeURIComponent(entryId)}`,
    ),
  createLibraryEntry: (projectId: string, input: Omit<CreateLibraryEntryInput, 'project_id'>) =>
    jsonFetch<{ entry: LibraryEntry }>(`/api/projects/${pid(projectId)}/library`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateLibraryEntry: (projectId: string, entryId: string, input: UpdateLibraryEntryInput) =>
    jsonFetch<{ entry: LibraryEntry }>(
      `/api/projects/${pid(projectId)}/library/${encodeURIComponent(entryId)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
  deleteLibraryEntry: (projectId: string, entryId: string) =>
    fetch(`/api/projects/${pid(projectId)}/library/${encodeURIComponent(entryId)}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(`DELETE library entry failed: ${r.status}`);
    }),
  attachLibraryNote: (projectId: string, entryId: string, itemId: string) =>
    fetch(
      `/api/projects/${pid(projectId)}/library/${encodeURIComponent(entryId)}/attach/${encodeURIComponent(itemId)}`,
      { method: 'POST' },
    ).then((r) => {
      if (!r.ok) throw new Error(`attach failed: ${r.status}`);
    }),
  detachLibraryNote: (projectId: string, entryId: string, itemId: string) =>
    fetch(
      `/api/projects/${pid(projectId)}/library/${encodeURIComponent(entryId)}/attach/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' },
    ).then((r) => {
      if (!r.ok) throw new Error(`detach failed: ${r.status}`);
    }),
  listAttachedItems: (projectId: string, entryId: string) =>
    jsonFetch<{ items: AttachedItemSummary[] }>(
      `/api/projects/${pid(projectId)}/library/${encodeURIComponent(entryId)}/attached-items`,
    ),
  listAttachedNotes: (projectId: string, itemId: string) =>
    jsonFetch<{ notes: LibraryEntry[] }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/attached-notes`,
    ),
  fillPrompt: (projectId: string, entryId: string, input: PromptFillRequest) =>
    jsonFetch<{ result: PromptFillResult }>(
      `/api/projects/${pid(projectId)}/library/${encodeURIComponent(entryId)}/prompt-fill`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  searchLibrary: (projectId: string, input: LibrarySearchRequest) =>
    jsonFetch<{ result: LibrarySearchResult }>(
      `/api/projects/${pid(projectId)}/library/search`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  semanticSearchLibrary: (projectId: string, input: LibrarySearchRequest) =>
    jsonFetch<{ result: LibrarySearchResult }>(
      `/api/projects/${pid(projectId)}/library/semantic-search`,
      { method: 'POST', body: JSON.stringify(input) },
    ),

  listScratchpadJots: (projectId: string, limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    return jsonFetch<{ jots: ScratchpadJot[] }>(
      `/api/projects/${pid(projectId)}/scratchpad/jots${qs}`,
    );
  },
  createScratchpadJot: (projectId: string, body: string) =>
    jsonFetch<{ jot: ScratchpadJot }>(`/api/projects/${pid(projectId)}/scratchpad/jots`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  deleteScratchpadJot: (projectId: string, jotId: string) =>
    fetch(`/api/projects/${pid(projectId)}/scratchpad/jots/${encodeURIComponent(jotId)}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(`DELETE jot failed: ${r.status}`);
    }),

  getInboxQueue: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    return jsonFetch<{ summary: InboxStatusSummary; entries: InboxQueueEntry[] }>(
      `/api/inbox/queue${qs}`,
    );
  },
  scanInbox: () => jsonFetch<{ ok: true }>('/api/inbox/scan', { method: 'POST' }),

  scanCodeTodos: (projectId: string, patterns?: string[]) =>
    jsonFetch<{ result: CodeTodoScanResult }>(`/api/projects/${pid(projectId)}/code-todo/scan`, {
      method: 'POST',
      body: JSON.stringify({ patterns: patterns ?? null }),
    }),

  // Phase 5 — reconcile engine.
  proposeReconcile: (projectId: string, input: ReconcileProposeRequest) =>
    jsonFetch<{ run: ReconcileRun }>(
      `/api/projects/${pid(projectId)}/reconcile/propose`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  applyReconcile: (projectId: string, input: ReconcileApplyRequest) =>
    jsonFetch<{ result: ReconcileApplyResult }>(
      `/api/projects/${pid(projectId)}/reconcile/apply`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  getReconcileRun: (projectId: string, runId: string) =>
    jsonFetch<{ run: ReconcileRun }>(
      `/api/projects/${pid(projectId)}/reconcile/runs/${encodeURIComponent(runId)}`,
    ),
  listReconcileRuns: (projectId: string) =>
    jsonFetch<{ runs: ReconcileRun[] }>(`/api/projects/${pid(projectId)}/reconcile/runs`),
  discardReconcileRun: (projectId: string, runId: string) =>
    fetch(`/api/projects/${pid(projectId)}/reconcile/runs/${encodeURIComponent(runId)}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(`DELETE reconcile run failed: ${r.status}`);
    }),

  listAudit: (opts: { entity_type?: string; entity_id?: string; project_id?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts.entity_type) params.set('entity_type', opts.entity_type);
    if (opts.entity_id) params.set('entity_id', opts.entity_id);
    if (opts.project_id) params.set('project_id', opts.project_id);
    if (opts.limit) params.set('limit', String(opts.limit));
    return jsonFetch<{ entries: AuditEntry[] }>(`/api/audit?${params.toString()}`);
  },
};
