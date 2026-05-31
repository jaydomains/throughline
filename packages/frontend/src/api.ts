import type {
  ApplyRequest,
  ApplyResult,
  BackupStatus,
  MethodologySummary,
  MethodologiesResponse,
  ItemsResponse,
  ItemResponse,
  PolicyResponse,
  SessionsResponse,
  SessionResponse,
  CostSummary,
  SecretsPresenceResult,
  SecretsWriteInput,
  UpdateProjectInput,
  AttachedItemSummary,
  AuditEntry,
  CodeTodoScanResult,
  CreateItemInput,
  ItemLinks,
  CreateDirectiveInput,
  CreateLibraryEntryInput,
  CreateProjectInput,
  CreateSessionInput,
  DisciplineDriftRescanResult,
  DisciplineDriftResult,
  DriftInboxResult,
  DriftReverifyResult,
  ItemPrAssociation,
  OrphanedRulesResult,
  PrLinkDetectResult,
  ProjectPrsResult,
  Directive,
  DirectiveKind,
  DirectiveParentType,
  DumpZoneProposal,
  GateFiring,
  GateFiringsResult,
  GateRunResult,
  ChecklistRun,
  CompanionChecklistsResult,
  SessionStartModesResult,
  SessionStartPromptResult,
  InboxQueueEntry,
  InboxStatusSummary,
  ModulesResult,
  LibraryEntry,
  LibraryEntryType,
  LibrarySearchRequest,
  LibrarySearchResult,
  MdIngestFolder,
  MdIngestResult,
  MdScanResult,
  Project,
  PromptFillRequest,
  PromptFillResult,
  ProposeRequest,
  ReconcileApplyRequest,
  ReconcileApplyResult,
  ReconcileProposeRequest,
  ReconcileRun,
  ScratchpadJot,
  CodeSearchResponse,
  ItemCodeRef,
  ConfirmCodeRefsRequest,
  CodeQaResult,
  NotificationTestResult,
  RagQueryRequest,
  RagQueryResult,
  RagReindexResult,
  SessionRetroRequest,
  SessionRetroResult,
  PeriodicReviewResult,
  PeriodicReviewSynthesis,
  DoNextResult,
  StakeholderViewResult,
  ChatHistoryResult,
  ChatSendRequest,
  ChatSendResult,
  ChatProposeRequest,
  CommunicationGraph,
  CommunicationModelView,
  UpdateCommunicationProjectSettingsInput,
  Session,
  UpdateDirectiveInput,
  UpdateItemInput,
  UpdateLibraryEntryInput,
  UpdateSessionInput,
  BootstrapImportResult,
  BootstrapListConflictsResult,
  BootstrapConflictResolution,
  BootstrapStaleResolution,
  BootstrapResolveResult,
  BootstrapRenderResult,
  BootstrapState,
} from '@throughline/shared';

// MethodologySummary moved to @throughline/shared (T-D59 — wire-contract types live in
// shared). Re-exported here so existing `import { MethodologySummary } from '../api.js'`
// consumers keep working.
export type { MethodologySummary };

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
  listProjects: (includeArchived = false) =>
    jsonFetch<{ projects: Project[] }>(
      `/api/projects${includeArchived ? '?include_archived=true' : ''}`,
    ),
  deleteProject: (id: string) =>
    jsonFetch<{ ok: true }>(`/api/projects/${pid(id)}`, { method: 'DELETE' }),
  createProject: (input: CreateProjectInput) =>
    jsonFetch<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listMethodologies: () => jsonFetch<MethodologiesResponse>('/api/methodologies'),
  switchProject: (id: string) =>
    jsonFetch<{ ok: true }>(`/api/projects/${pid(id)}/switch`, { method: 'POST' }),
  updateProject: (id: string, input: UpdateProjectInput) =>
    jsonFetch<{ project: Project }>(`/api/projects/${pid(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  getSettings: () => jsonFetch<{ settings: Record<string, unknown> }>('/api/settings'),
  updateSettings: (entries: Record<string, unknown>) =>
    jsonFetch<{ settings: Record<string, unknown> }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(entries),
    }),

  // Phase 18 Slice 2 — per-project communication-model view + settings writer.
  getCommunicationModel: (projectId: string) =>
    jsonFetch<CommunicationModelView>(`/api/projects/${pid(projectId)}/communication-model`),
  updateCommunicationModel: (projectId: string, input: UpdateCommunicationProjectSettingsInput) =>
    jsonFetch<{ settings: Record<string, unknown> }>(
      `/api/projects/${pid(projectId)}/communication-model`,
      { method: 'PUT', body: JSON.stringify(input) },
    ),
  // Phase 18 Slice 3 — rule-level graph derived from bundle + items + module-tier assignments.
  getCommunicationGraph: (projectId: string) =>
    jsonFetch<CommunicationGraph>(`/api/projects/${pid(projectId)}/communication-model/graph`),

  // Phase 15 — secrets (T-D4: write-only from the browser; never read back).
  getSecrets: () => jsonFetch<SecretsPresenceResult>('/api/secrets'),
  updateSecrets: (input: SecretsWriteInput) =>
    jsonFetch<SecretsPresenceResult>('/api/secrets', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  testNotification: () =>
    jsonFetch<NotificationTestResult>('/api/notifications/test', { method: 'POST' }),

  // Phase 15 — backup (T-D28) + cost meter (T-D29).
  getBackupStatus: () => jsonFetch<BackupStatus>('/api/backup/status'),
  exportBackup: async () => {
    const res = await fetch('/api/backup/export', { method: 'POST' });
    if (!res.ok) throw new Error(`backup export failed: ${res.status}`);
    const disp = res.headers.get('content-disposition') ?? '';
    const m = /filename="([^"]+)"/.exec(disp);
    const filename = m ? m[1]! : 'throughline-backup.sqlite';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { filename };
  },
  getCostSummary: (opts: { projectId?: string | null; scope?: 'project' | 'global' } = {}) => {
    const params = new URLSearchParams();
    if (opts.projectId) params.set('project_id', opts.projectId);
    if (opts.scope) params.set('scope', opts.scope);
    const qs = params.toString();
    return jsonFetch<CostSummary>(`/api/cost/summary${qs ? `?${qs}` : ''}`);
  },

  getPolicy: (projectId: string) =>
    jsonFetch<PolicyResponse>(`/api/projects/${pid(projectId)}/policy`),

  getModules: (projectId: string) =>
    jsonFetch<ModulesResult>(`/api/projects/${pid(projectId)}/modules`),

  listSessions: (projectId: string) =>
    jsonFetch<SessionsResponse>(`/api/projects/${pid(projectId)}/sessions`),
  createSession: (projectId: string, input: Omit<CreateSessionInput, 'project_id'>) =>
    jsonFetch<SessionResponse>(`/api/projects/${pid(projectId)}/sessions`, {
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
    return jsonFetch<ItemsResponse>(
      `/api/projects/${pid(projectId)}/items${qs ? `?${qs}` : ''}`,
    );
  },
  getItem: (projectId: string, itemId: string) =>
    jsonFetch<ItemResponse>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}`,
    ),
  getItemLinks: (projectId: string, itemId: string) =>
    jsonFetch<{ links: ItemLinks }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/links`,
    ),
  createItem: (projectId: string, input: Omit<CreateItemInput, 'project_id'>) =>
    jsonFetch<ItemResponse>(`/api/projects/${pid(projectId)}/items`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateItem: (projectId: string, itemId: string, input: UpdateItemInput) =>
    jsonFetch<ItemResponse>(
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
    jsonFetch<ItemResponse>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/tags`,
      { method: 'POST', body: JSON.stringify({ tag }) },
    ),
  removeItemTag: (projectId: string, itemId: string, tag: string) =>
    jsonFetch<ItemResponse>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/tags/${encodeURIComponent(tag)}`,
      { method: 'DELETE' },
    ),
  addItemBlocker: (projectId: string, itemId: string, blockedById: string) =>
    jsonFetch<ItemResponse>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/blockers`,
      { method: 'POST', body: JSON.stringify({ blocked_by_item_id: blockedById }) },
    ),
  removeItemBlocker: (projectId: string, itemId: string, blockedById: string) =>
    jsonFetch<ItemResponse>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/blockers/${encodeURIComponent(blockedById)}`,
      { method: 'DELETE' },
    ),
  addItemSessionMembership: (projectId: string, itemId: string, sessionId: string) =>
    jsonFetch<ItemResponse>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'POST' },
    ),
  removeItemSessionMembership: (projectId: string, itemId: string, sessionId: string) =>
    jsonFetch<ItemResponse>(
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

  // Phase 11 — Semble code intelligence (SPEC §7.15; C-D17).
  codeSearchItem: (projectId: string, itemId: string) =>
    jsonFetch<{ result: CodeSearchResponse }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/code-search`,
      { method: 'POST', body: '{}' },
    ),
  listItemCodeRefs: (projectId: string, itemId: string) =>
    jsonFetch<{ refs: ItemCodeRef[] }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/code-refs`,
    ),
  confirmItemCodeRefs: (projectId: string, itemId: string, input: ConfirmCodeRefsRequest) =>
    jsonFetch<{ refs: ItemCodeRef[] }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/code-refs`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  removeItemCodeRef: (projectId: string, itemId: string, refId: string) =>
    fetch(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/code-refs/${encodeURIComponent(refId)}`,
      { method: 'DELETE' },
    ).then((r) => {
      if (!r.ok) throw new Error(`DELETE code-ref failed: ${r.status}`);
    }),
  codeQa: (projectId: string, question: string) =>
    jsonFetch<{ result: CodeQaResult }>(`/api/projects/${pid(projectId)}/code-qa`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

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

  // Phase 6b — directives (T-D12). Three kinds: pin, reminder, include_prompt.
  listDirectives: (
    projectId: string,
    opts: { kind?: DirectiveKind; parentType?: DirectiveParentType; parentId?: string } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.kind) params.set('kind', opts.kind);
    if (opts.parentType) params.set('parentType', opts.parentType);
    if (opts.parentId) params.set('parentId', opts.parentId);
    const qs = params.toString();
    return jsonFetch<{ directives: Directive[] }>(
      `/api/projects/${pid(projectId)}/directives${qs ? `?${qs}` : ''}`,
    );
  },
  listDirectivesForItem: (projectId: string, itemId: string) =>
    jsonFetch<{ directives: Directive[] }>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/directives`,
    ),
  listDirectivesForLibraryEntry: (projectId: string, entryId: string) =>
    jsonFetch<{ directives: Directive[] }>(
      `/api/projects/${pid(projectId)}/library/${encodeURIComponent(entryId)}/directives`,
    ),
  createDirective: (projectId: string, input: Omit<CreateDirectiveInput, 'project_id'>) =>
    jsonFetch<{ directive: Directive }>(`/api/projects/${pid(projectId)}/directives`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateDirective: (projectId: string, directiveId: string, input: UpdateDirectiveInput) =>
    jsonFetch<{ directive: Directive }>(
      `/api/projects/${pid(projectId)}/directives/${encodeURIComponent(directiveId)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
  deleteDirective: (projectId: string, directiveId: string) =>
    fetch(`/api/projects/${pid(projectId)}/directives/${encodeURIComponent(directiveId)}`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(`DELETE directive failed: ${r.status}`);
    }),

  // Phase 6c — repo `.md` ingestion (T-D11).
  listMdFolders: (projectId: string) =>
    jsonFetch<{ folders: MdIngestFolder[] }>(
      `/api/projects/${pid(projectId)}/md-ingest/folders`,
    ),
  addMdFolder: (projectId: string, path: string) =>
    jsonFetch<{ folder: MdIngestFolder }>(
      `/api/projects/${pid(projectId)}/md-ingest/folders`,
      { method: 'POST', body: JSON.stringify({ path }) },
    ),
  removeMdFolder: (projectId: string, folderId: string) =>
    fetch(
      `/api/projects/${pid(projectId)}/md-ingest/folders/${encodeURIComponent(folderId)}`,
      { method: 'DELETE' },
    ).then((r) => {
      if (!r.ok) throw new Error(`DELETE md folder failed: ${r.status}`);
    }),
  scanMdFolder: (projectId: string, folderId: string) =>
    jsonFetch<{ result: MdScanResult }>(
      `/api/projects/${pid(projectId)}/md-ingest/scan`,
      { method: 'POST', body: JSON.stringify({ folder_id: folderId }) },
    ),
  ingestMd: (projectId: string, folderId: string, paths: string[]) =>
    jsonFetch<{ result: MdIngestResult }>(
      `/api/projects/${pid(projectId)}/md-ingest/ingest`,
      { method: 'POST', body: JSON.stringify({ folder_id: folderId, paths }) },
    ),
  setMdTracked: (projectId: string, entryId: string, tracked: boolean) =>
    jsonFetch<{ entry: LibraryEntry }>(
      `/api/projects/${pid(projectId)}/md-ingest/entries/${encodeURIComponent(entryId)}/track`,
      { method: 'PATCH', body: JSON.stringify({ tracked }) },
    ),
  reingestMd: (projectId: string, entryId: string) =>
    jsonFetch<{ entry: LibraryEntry; changed: boolean }>(
      `/api/projects/${pid(projectId)}/md-ingest/entries/${encodeURIComponent(entryId)}/reingest`,
      { method: 'POST' },
    ),

  // Phase 20 — bootstrap-ingest review surface (C-D20 surface 5).
  importBootstrap: (projectId: string, body: unknown) =>
    jsonFetch<{ result: BootstrapImportResult }>(
      `/api/projects/${pid(projectId)}/import`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  listBootstrapConflicts: (projectId: string) =>
    jsonFetch<{ result: BootstrapListConflictsResult }>(
      `/api/projects/${pid(projectId)}/import/conflicts`,
    ),
  resolveBootstrap: (
    projectId: string,
    body: { conflicts?: BootstrapConflictResolution[]; stale?: BootstrapStaleResolution[] },
  ) =>
    jsonFetch<{ result: BootstrapResolveResult }>(
      `/api/projects/${pid(projectId)}/import/resolve`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  // Phase 21 — bootstrap producer pipeline (C-D21).
  renderBootstrapPrompt: (projectId: string) =>
    jsonFetch<{ result: BootstrapRenderResult }>(
      `/api/projects/${pid(projectId)}/bootstrap/render`,
      { method: 'POST' },
    ),
  getBootstrapState: (projectId: string) =>
    jsonFetch<{ result: BootstrapState }>(
      `/api/projects/${pid(projectId)}/bootstrap/state`,
    ),

  listAudit: (opts: { entity_type?: string; entity_id?: string; project_id?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts.entity_type) params.set('entity_type', opts.entity_type);
    if (opts.entity_id) params.set('entity_id', opts.entity_id);
    if (opts.project_id) params.set('project_id', opts.project_id);
    if (opts.limit) params.set('limit', String(opts.limit));
    return jsonFetch<{ entries: AuditEntry[] }>(`/api/audit?${params.toString()}`);
  },

  // Phase 8 — methodology gate runtime (C-D6).
  listGateFirings: (projectId: string) =>
    jsonFetch<GateFiringsResult>(`/api/projects/${pid(projectId)}/gate-firings`),
  runGateMoment: (projectId: string, moment: string) =>
    jsonFetch<GateRunResult>(
      `/api/projects/${pid(projectId)}/gates/${encodeURIComponent(moment)}/run`,
      { method: 'POST' },
    ),
  overrideGateFiring: (projectId: string, firingId: string, reason: string) =>
    jsonFetch<{ firing: GateFiring }>(
      `/api/projects/${pid(projectId)}/gate-firings/${encodeURIComponent(firingId)}/override`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),

  // Phase 12 — companion review runtime (C-D8, T-D45).
  listCompanionChecklists: (projectId: string) =>
    jsonFetch<CompanionChecklistsResult>(
      `/api/projects/${pid(projectId)}/companion/checklists`,
    ),
  listCompanionRuns: (projectId: string) =>
    jsonFetch<{ runs: ChecklistRun[] }>(`/api/projects/${pid(projectId)}/companion/runs`),
  startCompanionRun: (projectId: string, checklistId: string, companionMode: string | null) =>
    jsonFetch<{ run: ChecklistRun }>(`/api/projects/${pid(projectId)}/companion/runs`, {
      method: 'POST',
      body: JSON.stringify({ checklist_id: checklistId, companion_mode: companionMode }),
    }),
  runCompanionMechanicalStep: (projectId: string, runId: string, stepId: string) =>
    jsonFetch<{ run: ChecklistRun }>(
      `/api/projects/${pid(projectId)}/companion/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/mechanical`,
      { method: 'POST' },
    ),
  aiJudgeCompanionStep: (projectId: string, runId: string, stepId: string) =>
    jsonFetch<{ run: ChecklistRun }>(
      `/api/projects/${pid(projectId)}/companion/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/ai-judge`,
      { method: 'POST' },
    ),
  resolveCompanionJudgement: (
    projectId: string,
    runId: string,
    stepId: string,
    decision: 'pass' | 'fail' | 'skip',
    rationale: string,
  ) =>
    jsonFetch<{ run: ChecklistRun }>(
      `/api/projects/${pid(projectId)}/companion/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/judgement`,
      { method: 'POST', body: JSON.stringify({ decision, rationale }) },
    ),
  overrideCompanionStep: (projectId: string, runId: string, stepId: string, reason: string) =>
    jsonFetch<{ run: ChecklistRun }>(
      `/api/projects/${pid(projectId)}/companion/runs/${encodeURIComponent(runId)}/steps/${encodeURIComponent(stepId)}/override`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  completeCompanionRun: (
    projectId: string,
    runId: string,
    summary: string | undefined,
    itemIds: string[],
  ) =>
    jsonFetch<{ run: ChecklistRun }>(
      `/api/projects/${pid(projectId)}/companion/runs/${encodeURIComponent(runId)}/complete`,
      { method: 'POST', body: JSON.stringify({ summary, item_ids: itemIds }) },
    ),

  // Phase 13 — session-start scaffolding (C-D9, T-D12).
  getSessionStartModes: (projectId: string) =>
    jsonFetch<SessionStartModesResult>(
      `/api/projects/${pid(projectId)}/session-start/modes`,
    ),
  generateSessionStartPrompt: (projectId: string, companionMode: string | null) =>
    jsonFetch<SessionStartPromptResult>(
      `/api/projects/${pid(projectId)}/session-start-prompt`,
      { method: 'POST', body: JSON.stringify({ companion_mode: companionMode }) },
    ),

  // Phase 9 — discipline-drift (C-D7).
  getDisciplineDrift: (projectId: string) =>
    jsonFetch<DisciplineDriftResult>(`/api/projects/${pid(projectId)}/discipline-drift`),
  rescanDisciplineDrift: (projectId: string) =>
    jsonFetch<DisciplineDriftRescanResult>(
      `/api/projects/${pid(projectId)}/discipline-drift/rescan`,
      { method: 'POST' },
    ),

  // Phase 10 — GitHub integration & code-drift (C-D16).
  getProjectPrs: (projectId: string) =>
    jsonFetch<ProjectPrsResult>(`/api/projects/${pid(projectId)}/github/prs`),
  refreshProjectPrs: (projectId: string) =>
    jsonFetch<ProjectPrsResult>(`/api/projects/${pid(projectId)}/github/refresh`, {
      method: 'POST',
    }),
  getDriftInbox: (projectId: string) =>
    jsonFetch<DriftInboxResult>(`/api/projects/${pid(projectId)}/drift/inbox`),
  dismissDriftSignal: (projectId: string, signalId: string, reason?: string) =>
    jsonFetch<{ ok: boolean }>(
      `/api/projects/${pid(projectId)}/drift/signals/${encodeURIComponent(signalId)}/dismiss`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  reopenDriftSignal: (projectId: string, signalId: string) =>
    jsonFetch<{ ok: boolean }>(
      `/api/projects/${pid(projectId)}/drift/signals/${encodeURIComponent(signalId)}/reopen`,
      { method: 'POST' },
    ),
  reverifyDriftSignal: (projectId: string, signalId: string) =>
    jsonFetch<DriftReverifyResult>(
      `/api/projects/${pid(projectId)}/drift/signals/${encodeURIComponent(signalId)}/reverify`,
      { method: 'POST' },
    ),
  detectPrLink: (projectId: string, itemId: string) =>
    jsonFetch<PrLinkDetectResult>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/pr-link/detect`,
    ),
  setPrLink: (projectId: string, itemId: string, prNumber: number, autoDetected: boolean) =>
    jsonFetch<ItemPrAssociation>(
      `/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/pr-link`,
      { method: 'POST', body: JSON.stringify({ pr_number: prNumber, auto_detected: autoDetected }) },
    ),
  clearPrLink: (projectId: string, itemId: string) =>
    fetch(`/api/projects/${pid(projectId)}/items/${encodeURIComponent(itemId)}/pr-link`, {
      method: 'DELETE',
    }).then((r) => {
      if (!r.ok) throw new Error(`DELETE pr-link failed: ${r.status}`);
    }),
  listOrphanRules: (projectId: string) =>
    jsonFetch<OrphanedRulesResult>(`/api/projects/${pid(projectId)}/orphan-rules`),
  dismissOrphanRule: (projectId: string, ruleId: string) =>
    jsonFetch<{ ok: boolean }>(
      `/api/projects/${pid(projectId)}/orphan-rules/${encodeURIComponent(ruleId)}/dismiss`,
      { method: 'POST' },
    ),
  draftOrphanCleanupPr: (projectId: string, ruleId: string) =>
    jsonFetch<{ pr_url: string; pr_number: number }>(
      `/api/projects/${pid(projectId)}/orphan-rules/${encodeURIComponent(ruleId)}/cleanup-pr`,
      { method: 'POST' },
    ),
  undoAutoReconcile: (projectId: string, token: string) =>
    jsonFetch<{ ok: boolean }>(
      `/api/projects/${pid(projectId)}/github/auto-reconcile/undo`,
      { method: 'POST', body: JSON.stringify({ token }) },
    ),
  approveAutoReconcile: (projectId: string, runId: string) =>
    jsonFetch<{ ok: boolean }>(
      `/api/projects/${pid(projectId)}/github/auto-reconcile/approve`,
      { method: 'POST', body: JSON.stringify({ run_id: runId }) },
    ),

  // Phase 14 — personal RAG (T-D25, C-D2; SPEC §7.18).
  ragQuery: (projectId: string, req: RagQueryRequest) =>
    jsonFetch<RagQueryResult>(`/api/projects/${pid(projectId)}/intelligence/rag`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  reindexText: (projectId: string) =>
    jsonFetch<RagReindexResult>(
      `/api/projects/${pid(projectId)}/intelligence/reindex`,
      { method: 'POST' },
    ),
  sessionRetro: (projectId: string, req: SessionRetroRequest) =>
    jsonFetch<SessionRetroResult>(`/api/projects/${pid(projectId)}/intelligence/retro`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  getPeriodicReview: (projectId: string) =>
    jsonFetch<PeriodicReviewResult>(
      `/api/projects/${pid(projectId)}/intelligence/periodic-review`,
    ),
  synthesizePeriodicReview: (projectId: string) =>
    jsonFetch<PeriodicReviewSynthesis>(
      `/api/projects/${pid(projectId)}/intelligence/periodic-review/synthesize`,
      { method: 'POST' },
    ),
  getDoNext: (projectId: string) =>
    jsonFetch<DoNextResult>(`/api/projects/${pid(projectId)}/intelligence/do-next`),
  getStakeholderView: (projectId: string, itemId: string) =>
    jsonFetch<StakeholderViewResult>(
      `/api/projects/${pid(projectId)}/intelligence/items/${encodeURIComponent(itemId)}/stakeholder`,
    ),
  getChatHistory: (projectId: string, contextType: string, contextId: string) =>
    jsonFetch<ChatHistoryResult>(
      `/api/projects/${pid(projectId)}/intelligence/chat?context_type=${encodeURIComponent(
        contextType,
      )}&context_id=${encodeURIComponent(contextId)}`,
    ),
  sendChat: (projectId: string, req: ChatSendRequest) =>
    jsonFetch<ChatSendResult>(`/api/projects/${pid(projectId)}/intelligence/chat`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  proposeFromChat: (projectId: string, req: ChatProposeRequest) =>
    jsonFetch<DumpZoneProposal>(
      `/api/projects/${pid(projectId)}/intelligence/chat/propose`,
      { method: 'POST', body: JSON.stringify(req) },
    ),
};
