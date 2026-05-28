import { vi } from 'vitest';
import type {
  ApplyRequest,
  AttachedItemSummary,
  CommunicationGraph,
  CommunicationModelView,
  UpdateCommunicationProjectSettingsInput,
  AuditEntry,
  ChecklistRun,
  CodeTodoScanResult,
  CreateDirectiveInput,
  CreateItemInput,
  CreateLibraryEntryInput,
  CreateProjectInput,
  CreateSessionInput,
  Directive,
  DirectiveKind,
  DirectiveParentType,
  DumpZoneProposal,
  GateFiring,
  GateMomentGroup,
  InboxQueueEntry,
  InboxStatusSummary,
  Item,
  ItemPolicy,
  LibraryEntry,
  LibrarySearchRequest,
  MdIngestFolder,
  MdScanResult,
  PromptFillRequest,
  Project,
  ProposeRequest,
  ReconcileApplyRequest,
  ReconcileApplyResult,
  ReconcileProposeRequest,
  ReconcileRow,
  ReconcileRun,
  ScratchpadJot,
  Session,
  UpdateDirectiveInput,
  UpdateItemInput,
  UpdateLibraryEntryInput,
  UpdateSessionInput,
} from '@throughline/shared';
import { computeNextFireAt, renderPromptBody } from '@throughline/shared';

interface State {
  projects: Project[];
  sessions: Session[];
  items: Item[];
  audit: AuditEntry[];
  settings: Record<string, unknown>;
  proposals: DumpZoneProposal[];
  library: LibraryEntry[];
  attachments: Array<{ item_id: string; library_entry_id: string }>;
  jots: ScratchpadJot[];
  inbox: InboxQueueEntry[];
  reconcileRuns: ReconcileRun[];
  driftSignals: Array<{ id: string; category: string }>;
  directives: Directive[];
  mdFolders: MdIngestFolder[];
  mdScans: Record<string, MdScanResult>;
}

const DEFAULT_PROJECT: Project = {
  id: 'p1',
  name: 'demo',
  repo_path: '/tmp/demo',
  github_owner: null,
  github_repo: null,
  bundle_id: 'freeform',
  bundle_path: null,
  state: 'active',
  settings_json: {},
  created_at: '',
  updated_at: '',
  archived_at: null,
};

const state: State = {
  projects: [DEFAULT_PROJECT],
  sessions: [],
  items: [],
  audit: [],
  settings: { stale_threshold_days: 14, last_active_project_id: 'p1' },
  proposals: [],
  library: [],
  attachments: [],
  jots: [],
  inbox: [],
  reconcileRuns: [],
  driftSignals: [],
  directives: [],
  mdFolders: [],
  mdScans: {},
};

let counter = 0;
function id(prefix: string) {
  counter += 1;
  return `${prefix}${counter}`;
}

const FREEFORM_POLICY: ItemPolicy = {
  bundle_id: 'freeform',
  types: ['task'],
  statuses: ['open', 'done'],
  statuses_by_type: { task: ['open', 'done'] },
  boards: [{ id: 'tasks', label: 'Tasks', type: 'task', statuses: ['open', 'done'] }],
};

export function resetMockApi() {
  state.projects = [DEFAULT_PROJECT];
  state.sessions = [];
  state.items = [];
  state.audit = [];
  state.settings = { stale_threshold_days: 14, last_active_project_id: 'p1' };
  state.proposals = [];
  state.library = [];
  state.attachments = [];
  state.jots = [];
  state.inbox = [];
  state.reconcileRuns = [];
  state.driftSignals = [];
  state.directives = [];
  state.mdFolders = [];
  state.mdScans = {};
  counter = 0;
  for (const fn of Object.values(mockApi)) {
    if (typeof fn === 'function' && 'mockClear' in fn) (fn as { mockClear: () => void }).mockClear();
  }
}

export function seedLibraryEntry(
  entry: Partial<LibraryEntry> & { id: string; project_id: string; type: LibraryEntry['type']; title: string },
) {
  state.library.push({
    body: '',
    tags: [],
    summary: null,
    source_path: null,
    source_tracked: false,
    source_hash: null,
    ingested_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...entry,
  });
}

export function seedMdFolder(
  f: Partial<MdIngestFolder> & { id: string; project_id: string; rel_path: string },
) {
  state.mdFolders.push({ created_at: '2026-01-01T00:00:00.000Z', ...f });
}

export function seedMdScan(folderId: string, result: MdScanResult) {
  state.mdScans[folderId] = result;
}

export function seedAttachment(itemId: string, libraryEntryId: string) {
  state.attachments.push({ item_id: itemId, library_entry_id: libraryEntryId });
}

export function seedInbox(entry: Partial<InboxQueueEntry> & { id: string; state: InboxQueueEntry['state'] }) {
  state.inbox.push({
    original_path: '/tmp/x.md',
    received_at: '2026-01-01T00:00:00.000Z',
    error_text: null,
    ...entry,
  });
}

export function seedSession(s: Partial<Session> & { id: string; project_id: string; name: string }) {
  state.sessions.push({
    branch_ref: null,
    context: null,
    settings_json: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...s,
  });
}

export function seedDirective(
  d: Partial<Directive> & {
    id: string;
    project_id: string;
    parent_type: DirectiveParentType;
    parent_id: string;
    kind: DirectiveKind;
  },
) {
  state.directives.push({
    payload: {},
    next_fire_at: null,
    last_fired_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...d,
  });
}

export function seedItem(i: Partial<Item> & { id: string; project_id: string; title: string }) {
  state.items.push({
    type: 'task',
    description: '',
    status: 'open',
    blocker_text: null,
    parent_id: null,
    branch_ref: null,
    tags: [],
    blockers: [],
    mentions: [],
    session_ids: [],
    methodology_context: {
      primary_unit_refs: [],
      phase_refs: [],
      anchor_citations: [],
      marker_refs: [],
    },
    methodology_drift: false,
    code_drift_tier: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
    ...i,
  });
}

export const mockApi = {
  health: vi.fn(async () => ({ ok: true, version: 'test' })),
  listProjects: vi.fn(async (includeArchived = false) => ({
    projects: state.projects.filter((p) => includeArchived || p.state !== 'archived'),
  })),
  deleteProject: vi.fn(async (pId: string) => {
    state.projects = state.projects.filter((x) => x.id !== pId);
    return { ok: true as const };
  }),
  createProject: vi.fn(async (input: CreateProjectInput) => {
    const project: Project = {
      id: id('p'),
      name: input.name,
      repo_path: input.repo_path,
      github_owner: input.github_owner ?? null,
      github_repo: input.github_repo ?? null,
      bundle_id: input.bundle_id ?? 'freeform',
      bundle_path: input.bundle_path ?? null,
      state: 'active',
      settings_json: input.settings ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    };
    state.projects.push(project);
    return { project };
  }),
  listMethodologies: vi.fn(async () => ({ methodologies: [] })),
  switchProject: vi.fn(async () => ({ ok: true as const })),
  getSettings: vi.fn(async () => ({ settings: state.settings })),
  updateSettings: vi.fn(async (entries: Record<string, unknown>) => {
    state.settings = { ...state.settings, ...entries };
    return { settings: state.settings };
  }),

  // Phase 18 Slice 2 — per-project communication-model view + settings writer.
  // Default to a freeform-shaped empty view so tests that don't care about the
  // surface stay quiet; opt-in tests pass `mockCommunicationModelView()` overrides.
  getCommunicationModel: vi.fn(async (_projectId: string): Promise<CommunicationModelView> => ({
    bundle: { status: 'none', edge_types: [], tier_routing: [], producer_ownership: null },
    contract_sources: {},
    module_tiers: {},
    resolved: {
      contract_sources: {},
      module_tiers: {},
      declared_tiers: [],
    },
  })),
  updateCommunicationModel: vi.fn(
    async (_pid: string, _input: UpdateCommunicationProjectSettingsInput) => ({
      settings: state.settings,
    }),
  ),
  // Phase 18 Slice 3 — default to an empty graph (freeform-shaped). Tests that
  // need a populated graph override via `mockImplementation`.
  getCommunicationGraph: vi.fn(async (_projectId: string): Promise<CommunicationGraph> => ({
    modules: [],
    edges: [],
    producer_owns_shape: false,
  })),
  updateProject: vi.fn(async (pId: string, input: Record<string, unknown>) => {
    const p = state.projects.find((x) => x.id === pId)!;
    Object.assign(p, input, { updated_at: new Date().toISOString() });
    return { project: p };
  }),
  getSecrets: vi.fn(async () => ({ anthropic_api_key: false, github_pat: false })),
  updateSecrets: vi.fn(async () => ({ anthropic_api_key: true, github_pat: false })),
  testNotification: vi.fn(async () => ({ ok: true as const })),
  getBackupStatus: vi.fn(async () => ({
    last_backup_at: null,
    threshold_days: 7,
    stale: true,
    auto_copy_target_path: null,
    last_auto_copy_at: null,
  })),
  exportBackup: vi.fn(async () => ({ filename: 'throughline-backup-test.sqlite' })),
  getCostSummary: vi.fn(async () => ({
    scope: 'global' as const,
    project_id: null,
    day: { usd_estimate: 0, input_tokens: 0, output_tokens: 0, call_count: 0, by_feature: [] },
    week: { usd_estimate: 0, input_tokens: 0, output_tokens: 0, call_count: 0, by_feature: [] },
    month: { usd_estimate: 0, input_tokens: 0, output_tokens: 0, call_count: 0, by_feature: [] },
    daily_threshold_usd: null,
    daily_threshold_exceeded: false,
  })),
  getPolicy: vi.fn(async (_projectId: string) => ({ policy: FREEFORM_POLICY })),
  getModules: vi.fn(async (_projectId: string) => ({
    primary_unit_label: null as string | null,
    modules: [] as Array<{
      ref: string;
      item_count: number;
      phases: string[];
      anchor_count: number;
      marker_count: number;
      tier: string;
      drift_signal_count: number;
    }>,
  })),
  getDisciplineDrift: vi.fn(async (_projectId: string) => ({
    groups: [] as Array<{
      category: string;
      signals: Array<{
        id: string;
        project_id: string;
        category: string;
        item_id: string | null;
        primary_unit_ref: string | null;
        reason: string;
        created_at: string;
      }>;
    }>,
  })),
  rescanDisciplineDrift: vi.fn(async (_projectId: string) => ({
    groups: [] as Array<{
      category: string;
      signals: Array<{
        id: string;
        project_id: string;
        category: string;
        item_id: string | null;
        primary_unit_ref: string | null;
        reason: string;
        created_at: string;
      }>;
    }>,
  })),

  // Phase 12 — companion review runtime (C-D8). Default to no declared checklists so the
  // surface stays hidden unless a test opts in.
  listCompanionChecklists: vi.fn(async (_projectId: string) => ({
    checklists: [] as Array<{
      id: string;
      name: string;
      steps: Array<{ id: string; kind: 'mechanical' | 'judgement'; description: string }>;
    }>,
    companion_modes: [] as Array<{ id: string; name: string }>,
  })),
  listCompanionRuns: vi.fn(async (_projectId: string) => ({ runs: [] as never[] })),
  startCompanionRun: vi.fn(async (): Promise<{ run: ChecklistRun }> => {
    throw new Error('not mocked');
  }),
  runCompanionMechanicalStep: vi.fn(async (): Promise<{ run: ChecklistRun }> => {
    throw new Error('not mocked');
  }),
  aiJudgeCompanionStep: vi.fn(async (): Promise<{ run: ChecklistRun }> => {
    throw new Error('not mocked');
  }),
  resolveCompanionJudgement: vi.fn(async (): Promise<{ run: ChecklistRun }> => {
    throw new Error('not mocked');
  }),
  overrideCompanionStep: vi.fn(async (): Promise<{ run: ChecklistRun }> => {
    throw new Error('not mocked');
  }),
  completeCompanionRun: vi.fn(async (): Promise<{ run: ChecklistRun }> => {
    throw new Error('not mocked');
  }),

  // Phase 13 — session-start scaffolding (C-D9, T-D12). Default to the freeform-shaped
  // single `default` mode so the panel renders uniformly unless a test opts in.
  getSessionStartModes: vi.fn(async (_projectId: string) => ({
    modes: [{ id: 'default', name: 'default' }],
    default_mode: 'default',
  })),
  generateSessionStartPrompt: vi.fn(
    async (): Promise<{
      mode: string;
      modes: Array<{ id: string; name: string }>;
      prompt: string;
      classifications: Array<{ ref: string; tier: 'high' | 'medium' | 'low' }>;
      cached: boolean;
      classifier_used_ai: boolean;
    }> => {
      throw new Error('not mocked');
    },
  ),

  // Phase 10 — GitHub integration & code-drift (C-D16).
  getProjectPrs: vi.fn(async (_projectId: string) => ({ configured: false, prs: [] })),
  refreshProjectPrs: vi.fn(async (_projectId: string) => ({ configured: false, prs: [] })),
  getDriftInbox: vi.fn(async (_projectId: string) => ({
    signals: [] as Array<{
      id: string;
      project_id: string;
      stream: 'code' | 'discipline';
      category: string;
      item_id: string | null;
      reason: string;
      created_at: string;
    }>,
    total_count: 0,
    code_count: 0,
    discipline_count: 0,
  })),
  dismissDriftSignal: vi.fn(async () => ({ ok: true })),
  reopenDriftSignal: vi.fn(async () => ({ ok: true })),
  reverifyDriftSignal: vi.fn(async (_pid: string, signalId: string) => ({
    signal_id: signalId,
    verdict: 'unclear' as const,
    detail: 'mock',
    model: null,
  })),
  detectPrLink: vi.fn(async (_pid: string, _itemId: string) => ({
    candidate: null,
    branch: null,
  })),
  setPrLink: vi.fn(async (_pid: string, itemId: string, prNumber: number) => ({
    item_id: itemId,
    pr_number: prNumber,
    repo: 'o/r',
    auto_detected_at: null,
  })),
  clearPrLink: vi.fn(async () => undefined),
  listOrphanRules: vi.fn(async (_projectId: string) => ({ rules: [] })),
  dismissOrphanRule: vi.fn(async () => ({ ok: true })),
  draftOrphanCleanupPr: vi.fn(async () => ({
    pr_url: 'https://example/pr/1',
    pr_number: 1,
  })),
  undoAutoReconcile: vi.fn(async () => ({ ok: true })),
  approveAutoReconcile: vi.fn(async () => ({ ok: true })),

  listSessions: vi.fn(async (projectId: string) => ({
    sessions: state.sessions.filter((s) => s.project_id === projectId),
  })),
  createSession: vi.fn(async (projectId: string, input: Omit<CreateSessionInput, 'project_id'>) => {
    const session: Session = {
      id: id('s'),
      project_id: projectId,
      name: input.name,
      branch_ref: input.branch_ref ?? null,
      context: input.context ?? null,
      settings_json: input.settings ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.sessions.push(session);
    return { session };
  }),
  updateSession: vi.fn(async (_pid: string, sessionId: string, input: UpdateSessionInput) => {
    const s = state.sessions.find((x) => x.id === sessionId);
    if (!s) throw new Error('not found');
    Object.assign(s, input);
    return { session: s };
  }),
  deleteSession: vi.fn(async (_pid: string, sessionId: string) => {
    state.sessions = state.sessions.filter((x) => x.id !== sessionId);
  }),

  listItems: vi.fn(async (projectId: string, opts?: { session_id?: string }) => ({
    items: state.items.filter(
      (i) =>
        i.project_id === projectId &&
        (opts?.session_id ? i.session_ids.includes(opts.session_id) : true),
    ),
  })),
  getItem: vi.fn(async (_pid: string, itemId: string) => {
    const item = state.items.find((x) => x.id === itemId);
    if (!item) throw new Error('not found');
    return { item };
  }),
  getItemLinks: vi.fn(async (_pid: string, itemId: string) => {
    const all = state.items;
    const self = all.find((x) => x.id === itemId);
    const summ = (x: Item) => ({ id: x.id, title: x.title, type: x.type, status: x.status });
    return {
      links: {
        parents: self?.parent_id ? all.filter((x) => x.id === self.parent_id).map(summ) : [],
        children: all.filter((x) => x.parent_id === itemId).map(summ),
        mentioned: self ? all.filter((x) => self.mentions.includes(x.id)).map(summ) : [],
        mentioning: all.filter((x) => x.mentions.includes(itemId)).map(summ),
      },
    };
  }),
  createItem: vi.fn(async (projectId: string, input: Omit<CreateItemInput, 'project_id'>) => {
    const item: Item = {
      id: id('i'),
      project_id: projectId,
      type: input.type ?? 'task',
      title: input.title,
      description: input.description ?? '',
      status: input.status ?? 'open',
      blocker_text: input.blocker_text ?? null,
      parent_id: input.parent_id ?? null,
      branch_ref: input.branch_ref ?? null,
      tags: input.tags ?? [],
      blockers: [],
      mentions: [],
      session_ids: input.session_ids ?? [],
      methodology_context: {
        primary_unit_refs: input.methodology_context?.primary_unit_refs ?? [],
        phase_refs: input.methodology_context?.phase_refs ?? [],
        anchor_citations: input.methodology_context?.anchor_citations ?? [],
        marker_refs: input.methodology_context?.marker_refs ?? [],
      },
      methodology_drift: false,
      code_drift_tier: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.items.push(item);
    return { item };
  }),
  updateItem: vi.fn(async (_pid: string, itemId: string, input: UpdateItemInput) => {
    const item = state.items.find((x) => x.id === itemId);
    if (!item) throw new Error('not found');
    const { methodology_context: ctx, ...rest } = input;
    Object.assign(item, rest);
    if (ctx) item.methodology_context = { ...item.methodology_context, ...ctx };
    item.updated_at = new Date().toISOString();
    return { item };
  }),
  deleteItem: vi.fn(async (_pid: string, itemId: string) => {
    state.items = state.items.filter((x) => x.id !== itemId);
  }),
  addItemTag: vi.fn(async (_pid: string, itemId: string, tag: string) => {
    const item = state.items.find((x) => x.id === itemId);
    if (!item) throw new Error('not found');
    if (!item.tags.includes(tag)) item.tags.push(tag);
    return { item };
  }),
  removeItemTag: vi.fn(async (_pid: string, itemId: string, tag: string) => {
    const item = state.items.find((x) => x.id === itemId);
    if (!item) throw new Error('not found');
    item.tags = item.tags.filter((t) => t !== tag);
    return { item };
  }),
  addItemBlocker: vi.fn(async (_pid: string, itemId: string, blockedById: string) => {
    const item = state.items.find((x) => x.id === itemId);
    if (!item) throw new Error('not found');
    if (!item.blockers.includes(blockedById)) item.blockers.push(blockedById);
    return { item };
  }),
  removeItemBlocker: vi.fn(async (_pid: string, itemId: string, blockedById: string) => {
    const item = state.items.find((x) => x.id === itemId);
    if (!item) throw new Error('not found');
    item.blockers = item.blockers.filter((b) => b !== blockedById);
    return { item };
  }),
  addItemSessionMembership: vi.fn(async (_pid: string, itemId: string, sessionId: string) => {
    const item = state.items.find((x) => x.id === itemId);
    if (!item) throw new Error('not found');
    if (!item.session_ids.includes(sessionId)) item.session_ids.push(sessionId);
    return { item };
  }),
  removeItemSessionMembership: vi.fn(async (_pid: string, itemId: string, sessionId: string) => {
    const item = state.items.find((x) => x.id === itemId);
    if (!item) throw new Error('not found');
    item.session_ids = item.session_ids.filter((s) => s !== sessionId);
    return { item };
  }),

  listAudit: vi.fn(async (opts: { entity_id?: string }) => ({
    entries: state.audit.filter((e) => (opts.entity_id ? e.entity_id === opts.entity_id : true)),
  })),

  // Phase 6b — directives.
  listDirectives: vi.fn(
    async (
      projectId: string,
      opts: { kind?: DirectiveKind; parentType?: DirectiveParentType; parentId?: string } = {},
    ) => ({
      directives: state.directives.filter(
        (d) =>
          d.project_id === projectId &&
          (opts.kind ? d.kind === opts.kind : true) &&
          (opts.parentType ? d.parent_type === opts.parentType : true) &&
          (opts.parentId ? d.parent_id === opts.parentId : true),
      ),
    }),
  ),
  listDirectivesForItem: vi.fn(async (_projectId: string, itemId: string) => ({
    directives: state.directives.filter(
      (d) => d.parent_type === 'item' && d.parent_id === itemId,
    ),
  })),
  listDirectivesForLibraryEntry: vi.fn(async (_projectId: string, entryId: string) => ({
    directives: state.directives.filter(
      (d) => d.parent_type === 'library' && d.parent_id === entryId,
    ),
  })),
  createDirective: vi.fn(
    async (projectId: string, input: Omit<CreateDirectiveInput, 'project_id'>) => {
      const payload = input.payload ?? {};
      const nextFireAt = computeNextFireAt(input.kind, payload, new Date());
      const directive: Directive = {
        id: id('dir'),
        project_id: projectId,
        parent_type: input.parent_type,
        parent_id: input.parent_id,
        kind: input.kind,
        payload,
        next_fire_at: nextFireAt,
        last_fired_at: null,
        created_at: new Date().toISOString(),
      };
      state.directives.push(directive);
      return { directive };
    },
  ),
  updateDirective: vi.fn(
    async (_projectId: string, directiveId: string, input: UpdateDirectiveInput) => {
      const d = state.directives.find((x) => x.id === directiveId);
      if (!d) throw new Error('not_found');
      if (input.payload !== undefined) {
        d.payload = input.payload;
        d.next_fire_at = computeNextFireAt(d.kind, input.payload, new Date());
      }
      return { directive: d };
    },
  ),
  deleteDirective: vi.fn(async (_projectId: string, directiveId: string) => {
    state.directives = state.directives.filter((d) => d.id !== directiveId);
  }),

  // Phase 4 — capture surfaces.
  proposeDumpZone: vi.fn(async (projectId: string, input: ProposeRequest) => {
    const proposal: DumpZoneProposal = {
      id: id('pr'),
      project_id: projectId,
      target: input.target,
      source: input.source,
      extractor: 'heuristic',
      raw_text: input.text,
      payload: {
        target: input.target,
        source: input.source,
        extractor: 'heuristic',
        items:
          input.target === 'session'
            ? input.text.split(/\n\s*\n+/).map((para, idx) => ({
                proposal_item_id: id('pi'),
                type: 'task',
                status: 'open',
                title: para.split('\n')[0]!.trim().slice(0, 80) || `item ${idx + 1}`,
                description: '',
                tags: [],
                target_session_id: input.session_id ?? null,
                confidence: null,
              }))
            : [],
        library:
          input.target === 'library'
            ? input.text.split(/\n\s*\n+/).map((para, idx) => ({
                proposal_item_id: id('pl'),
                type: 'note' as const,
                title: para.split('\n')[0]!.trim().slice(0, 80) || `entry ${idx + 1}`,
                body: para,
                tags: [],
              }))
            : [],
        clarifying_questions: [],
        suggested_session_id: input.session_id ?? null,
        extractor_note: 'mock extractor',
      },
      status: 'pending',
      created_at: new Date().toISOString(),
      resolved_at: null,
    };
    state.proposals.push(proposal);
    return { proposal };
  }),
  applyDumpZone: vi.fn(async (projectId: string, input: ApplyRequest) => {
    const proposal = state.proposals.find((p) => p.id === input.proposal_id);
    if (!proposal) throw new Error('not_found');
    const applied_item_ids: string[] = [];
    const applied_library_entry_ids: string[] = [];
    const decisions = input.decisions ?? {};
    for (const itemProposal of input.payload.items) {
      if (decisions[itemProposal.proposal_item_id] === 'discard') continue;
      const item: Item = {
        id: id('i'),
        project_id: projectId,
        type: itemProposal.type,
        title: itemProposal.title,
        description: itemProposal.description,
        status: itemProposal.status,
        blocker_text: null,
        parent_id: null,
        branch_ref: null,
        tags: itemProposal.tags,
        blockers: [],
        mentions: [],
        session_ids: itemProposal.target_session_id ? [itemProposal.target_session_id] : [],
        methodology_context: { primary_unit_refs: [], phase_refs: [], anchor_citations: [], marker_refs: [] },
        methodology_drift: false,
        code_drift_tier: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.items.push(item);
      applied_item_ids.push(item.id);
    }
    for (const entryProposal of input.payload.library) {
      if (decisions[entryProposal.proposal_item_id] === 'discard') continue;
      const entry: LibraryEntry = {
        id: id('le'),
        project_id: projectId,
        type: entryProposal.type,
        title: entryProposal.title,
        body: entryProposal.body,
        tags: entryProposal.tags,
        summary: null,
        source_path: null,
        source_tracked: false,
        source_hash: null,
        ingested_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.library.push(entry);
      applied_library_entry_ids.push(entry.id);
    }
    proposal.status = 'applied';
    proposal.resolved_at = new Date().toISOString();
    return { result: { applied_item_ids, applied_library_entry_ids } };
  }),
  getProposal: vi.fn(async (_pid: string, proposalId: string) => {
    const proposal = state.proposals.find((p) => p.id === proposalId);
    if (!proposal) throw new Error('not_found');
    return { proposal };
  }),
  discardProposal: vi.fn(async (_pid: string, proposalId: string) => {
    const p = state.proposals.find((x) => x.id === proposalId);
    if (p) p.status = 'discarded';
  }),

  listLibrary: vi.fn(
    async (
      projectId: string,
      opts?: { type?: LibraryEntry['type']; scope?: 'project' | 'global' },
    ) => {
      const all = opts?.scope === 'global'
        ? state.library
        : state.library.filter((e) => e.project_id === projectId);
      const filtered = opts?.type ? all.filter((e) => e.type === opts.type) : all;
      return { entries: filtered };
    },
  ),
  getLibraryEntry: vi.fn(async (_pid: string, entryId: string) => {
    const entry = state.library.find((e) => e.id === entryId);
    if (!entry) throw new Error('not_found');
    return { entry };
  }),
  createLibraryEntry: vi.fn(
    async (projectId: string, input: Omit<CreateLibraryEntryInput, 'project_id'>) => {
      const entry: LibraryEntry = {
        id: id('le'),
        project_id: projectId,
        type: input.type,
        title: input.title,
        body: input.body ?? '',
        tags: input.tags ?? [],
        summary: input.summary ?? null,
        source_path: input.source_path ?? null,
        source_tracked: input.source_tracked ?? false,
        source_hash: input.source_hash ?? null,
        ingested_at: input.ingested_at ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.library.push(entry);
      return { entry };
    },
  ),
  updateLibraryEntry: vi.fn(
    async (_pid: string, entryId: string, input: UpdateLibraryEntryInput) => {
      const entry = state.library.find((e) => e.id === entryId);
      if (!entry) throw new Error('not_found');
      if (input.title !== undefined) entry.title = input.title;
      if (input.body !== undefined) entry.body = input.body;
      if (input.tags !== undefined) entry.tags = input.tags;
      if (input.summary !== undefined) entry.summary = input.summary;
      if (input.source_tracked !== undefined) entry.source_tracked = input.source_tracked;
      if (input.source_hash !== undefined) entry.source_hash = input.source_hash;
      if (input.ingested_at !== undefined) entry.ingested_at = input.ingested_at;
      entry.updated_at = new Date().toISOString();
      return { entry };
    },
  ),
  deleteLibraryEntry: vi.fn(async (_pid: string, entryId: string) => {
    state.library = state.library.filter((e) => e.id !== entryId);
    state.attachments = state.attachments.filter((a) => a.library_entry_id !== entryId);
  }),
  attachLibraryNote: vi.fn(async (_pid: string, entryId: string, itemId: string) => {
    const entry = state.library.find((e) => e.id === entryId);
    if (!entry || entry.type !== 'note') throw new Error('not_a_note');
    const item = state.items.find((i) => i.id === itemId);
    if (!item) throw new Error('item_not_found');
    if (item.project_id !== entry.project_id) throw new Error('cross_project_attach');
    const exists = state.attachments.find(
      (a) => a.library_entry_id === entryId && a.item_id === itemId,
    );
    if (!exists) state.attachments.push({ item_id: itemId, library_entry_id: entryId });
  }),
  detachLibraryNote: vi.fn(async (_pid: string, entryId: string, itemId: string) => {
    state.attachments = state.attachments.filter(
      (a) => !(a.library_entry_id === entryId && a.item_id === itemId),
    );
  }),
  listAttachedItems: vi.fn(async (_pid: string, entryId: string) => {
    const ids = state.attachments
      .filter((a) => a.library_entry_id === entryId)
      .map((a) => a.item_id);
    const items: AttachedItemSummary[] = state.items
      .filter((i) => ids.includes(i.id))
      .map((i) => ({ id: i.id, title: i.title, type: i.type, status: i.status }));
    return { items };
  }),
  listAttachedNotes: vi.fn(async (_pid: string, itemId: string) => {
    const ids = state.attachments
      .filter((a) => a.item_id === itemId)
      .map((a) => a.library_entry_id);
    return { notes: state.library.filter((e) => ids.includes(e.id)) };
  }),
  fillPrompt: vi.fn(async (_pid: string, entryId: string, input: PromptFillRequest) => {
    const entry = state.library.find((e) => e.id === entryId);
    if (!entry) throw new Error('not_found');
    if (entry.type !== 'prompt') throw new Error('not_a_prompt');
    const result = renderPromptBody(entry.body, input.values);
    return { result };
  }),
  searchLibrary: vi.fn(async (projectId: string, input: LibrarySearchRequest) => {
    const q = input.query.trim().toLowerCase();
    const scope = input.scope ?? 'project';
    let pool = scope === 'global' ? state.library : state.library.filter((e) => e.project_id === projectId);
    if (input.type) pool = pool.filter((e) => e.type === input.type);
    const entries = q.length === 0 ? [] : pool.filter((e) => {
      return (
        e.title.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    return { result: { entries, via: 'fts' as const, truncated: false } };
  }),
  semanticSearchLibrary: vi.fn(async (_pid: string, _input: LibrarySearchRequest) => ({
    result: { entries: [], via: 'semantic-stub' as const, truncated: false },
  })),

  listScratchpadJots: vi.fn(async (projectId: string, _limit?: number) => ({
    jots: state.jots
      .filter((j) => j.project_id === null || j.project_id === projectId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
  })),
  createScratchpadJot: vi.fn(async (projectId: string, body: string) => {
    const jot: ScratchpadJot = {
      id: id('j'),
      project_id: projectId,
      body,
      created_at: new Date().toISOString(),
    };
    state.jots.push(jot);
    return { jot };
  }),
  deleteScratchpadJot: vi.fn(async (_pid: string, jotId: string) => {
    state.jots = state.jots.filter((j) => j.id !== jotId);
  }),

  getInboxQueue: vi.fn(async (_limit?: number) => {
    const entries = [...state.inbox];
    const summary: InboxStatusSummary = {
      queued: entries.filter((e) => e.state === 'queued').length,
      processed_recent: entries.filter((e) => e.state === 'processed').length,
      failed_recent: entries.filter((e) => e.state === 'failed').length,
    };
    return { summary, entries };
  }),
  scanInbox: vi.fn(async () => ({ ok: true as const })),

  scanCodeTodos: vi.fn(async (_pid: string, _patterns?: string[]) => {
    const result: CodeTodoScanResult = {
      scan_id: id('sc'),
      proposal_id: id('pr'),
      match_count: 3,
    };
    return { result };
  }),

  // Phase 5 — reconcile engine.
  proposeReconcile: vi.fn(async (projectId: string, input: ReconcileProposeRequest) => {
    // Mock heuristic: matches by title-substring against state.items in the same project,
    // then routes to completed/contradicted/new based on a tiny keyword set. Enough to
    // exercise the modal end-to-end without standing up the real backend.
    const blocks = input.text.split(/\n\s*\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
    const rows: ReconcileRow[] = [];
    const candidates = state.items.filter((i) => i.project_id === projectId);
    for (const block of blocks) {
      const lower = block.toLowerCase();
      const match = candidates.find((i) => lower.includes(i.title.toLowerCase()));
      if (match) {
        if (/(broken|regress|contradicts|reverted)/i.test(block)) {
          rows.push({
            category: 'contradicted',
            row_id: id('rr'),
            item_id: match.id,
            current_title: match.title,
            reason: block.slice(0, 200),
            evidence: block,
          });
        } else if (/(done|finished|shipped|complete)/i.test(block)) {
          rows.push({
            category: 'completed',
            row_id: id('rr'),
            item_id: match.id,
            current_status: match.status,
            next_status: 'done',
            current_title: match.title,
            evidence: block,
          });
        } else {
          rows.push({
            category: 'no_change',
            row_id: id('rr'),
            item_id: match.id,
            current_title: match.title,
            evidence: block,
          });
        }
      } else {
        rows.push({
          category: 'new',
          row_id: id('rr'),
          type: 'task',
          status: 'open',
          title: block.split('\n')[0]!.slice(0, 80),
          description: '',
          tags: [],
          evidence: block,
        });
      }
    }
    const run: ReconcileRun = {
      id: id('rc'),
      project_id: projectId,
      session_id: input.session_id ?? null,
      source: input.source,
      status: 'pending',
      raw_text: input.text,
      diff: {
        source: input.source,
        extractor: 'heuristic',
        session_id: input.session_id ?? null,
        rows,
        extractor_note: 'mock reconcile',
      },
      created_at: new Date().toISOString(),
      resolved_at: null,
    };
    state.reconcileRuns.push(run);
    return { run };
  }),
  applyReconcile: vi.fn(async (projectId: string, input: ReconcileApplyRequest) => {
    // Tolerate runs not previously seeded by proposeReconcile — direct ReconcileModal tests
    // pass a constructed run without going through propose.
    const run = state.reconcileRuns.find((r) => r.id === input.run_id) ?? null;
    const decisions = input.decisions ?? {};
    const result: ReconcileApplyResult = {
      completed_item_ids: [],
      new_item_ids: [],
      edited_item_ids: [],
      blocker_item_ids: [],
      no_change_item_ids: [],
      drift_signal_ids: [],
      rejected_row_ids: [],
    };
    for (const row of input.diff.rows) {
      if (decisions[row.row_id] === 'reject') {
        result.rejected_row_ids.push(row.row_id);
        continue;
      }
      switch (row.category) {
        case 'completed': {
          const item = state.items.find((i) => i.id === row.item_id);
          if (item) item.status = row.next_status;
          result.completed_item_ids.push(row.item_id);
          break;
        }
        case 'new': {
          const item: Item = {
            id: id('i'),
            project_id: projectId,
            type: row.type,
            title: row.title,
            description: row.description,
            status: row.status,
            blocker_text: null,
            parent_id: null,
            branch_ref: null,
            tags: row.tags,
            blockers: [],
            mentions: [],
            session_ids: input.diff.session_id ? [input.diff.session_id] : [],
            methodology_context: { primary_unit_refs: [], phase_refs: [], anchor_citations: [], marker_refs: [] },
            methodology_drift: false,
            code_drift_tier: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          state.items.push(item);
          result.new_item_ids.push(item.id);
          break;
        }
        case 'edited': {
          const item = state.items.find((i) => i.id === row.item_id);
          if (item) {
            item.title = row.next_title;
            item.description = row.next_description;
          }
          result.edited_item_ids.push(row.item_id);
          break;
        }
        case 'blocker': {
          const item = state.items.find((i) => i.id === row.item_id);
          if (item) item.blocker_text = row.next_blocker_text;
          result.blocker_item_ids.push(row.item_id);
          break;
        }
        case 'no_change':
          result.no_change_item_ids.push(row.item_id);
          break;
        case 'contradicted': {
          const driftId = id('drift');
          state.driftSignals.push({ id: driftId, category: 'tier-3' });
          result.drift_signal_ids.push(driftId);
          break;
        }
      }
    }
    if (run) {
      run.status = 'applied';
      run.resolved_at = new Date().toISOString();
    }
    return { result };
  }),
  getReconcileRun: vi.fn(async (_pid: string, runId: string) => {
    const run = state.reconcileRuns.find((r) => r.id === runId);
    if (!run) throw new Error('not_found');
    return { run };
  }),
  listReconcileRuns: vi.fn(async (projectId: string) => ({
    runs: state.reconcileRuns.filter((r) => r.project_id === projectId),
  })),
  discardReconcileRun: vi.fn(async (_pid: string, runId: string) => {
    const r = state.reconcileRuns.find((x) => x.id === runId);
    if (r && r.status === 'pending') r.status = 'discarded';
  }),

  // Phase 6c — repo `.md` ingestion.
  listMdFolders: vi.fn(async (projectId: string) => ({
    folders: state.mdFolders.filter((f) => f.project_id === projectId),
  })),
  addMdFolder: vi.fn(async (projectId: string, path: string) => {
    const existing = state.mdFolders.find(
      (f) => f.project_id === projectId && f.rel_path === path,
    );
    if (existing) return { folder: existing };
    const folder: MdIngestFolder = {
      id: id('mdf'),
      project_id: projectId,
      rel_path: path,
      created_at: new Date().toISOString(),
    };
    state.mdFolders.push(folder);
    return { folder };
  }),
  removeMdFolder: vi.fn(async (_pid: string, folderId: string) => {
    state.mdFolders = state.mdFolders.filter((f) => f.id !== folderId);
    delete state.mdScans[folderId];
  }),
  scanMdFolder: vi.fn(async (_pid: string, folderId: string) => {
    const result = state.mdScans[folderId] ?? {
      folder_id: folderId,
      candidates: [],
      truncated: false,
    };
    return { result };
  }),
  ingestMd: vi.fn(async (projectId: string, _folderId: string, paths: string[]) => {
    const ingested = paths.map((relPath) => {
      const existing = state.library.find(
        (e) => e.project_id === projectId && e.source_path === relPath,
      );
      if (existing) {
        existing.ingested_at = new Date().toISOString();
        return { entry_id: existing.id, rel_path: relPath, status: 'reingested' as const };
      }
      const entry: LibraryEntry = {
        id: id('le'),
        project_id: projectId,
        type: 'imported_doc',
        title: relPath.split('/').pop() ?? relPath,
        body: `body of ${relPath}`,
        tags: ['imported-doc'],
        summary: `summary of ${relPath}`,
        source_path: relPath,
        source_tracked: false,
        source_hash: 'hash-' + relPath,
        ingested_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.library.push(entry);
      return { entry_id: entry.id, rel_path: relPath, status: 'created' as const };
    });
    return { result: { ingested, skipped: [] } };
  }),
  setMdTracked: vi.fn(async (_pid: string, entryId: string, tracked: boolean) => {
    const entry = state.library.find((e) => e.id === entryId);
    if (!entry) throw new Error('not_found');
    entry.source_tracked = tracked;
    return { entry };
  }),
  reingestMd: vi.fn(async (_pid: string, entryId: string) => {
    const entry = state.library.find((e) => e.id === entryId);
    if (!entry) throw new Error('not_found');
    entry.ingested_at = new Date().toISOString();
    return { entry, changed: true };
  }),

  // Phase 20 — bootstrap-ingest (C-D20).
  importBootstrap: vi.fn(async (_projectId: string, _body: unknown) => ({
    result: {
      project_id: 'p',
      rows: [],
      counts: { new: 0, reimported: 0, conflict: 0, stale_flagged: 0 },
    },
  })),
  listBootstrapConflicts: vi.fn(async (_projectId: string) => ({
    result: { project_id: 'p', stale: [] as Array<{ entity_type: string; entity_id: string; bootstrap_id: string; title: string }> },
  })),
  resolveBootstrap: vi.fn(
    async (
      _projectId: string,
      _body: { conflicts?: unknown[]; stale?: unknown[] },
    ) => ({
      result: { applied: 0, noop: 0, errors: [] as Array<{ entity_id: string; message: string }> },
    }),
  ),

  // Phase 21 — bootstrap producer pipeline (C-D21).
  renderBootstrapPrompt: vi.fn(async (_projectId: string) => ({
    result: {
      promptPath: '/tmp/repo/.throughline/bootstrap-prompt.md',
      outputPath: '/tmp/repo/.throughline/bootstrap-output.json',
      bundlePath: '/tmp/methodologies/freeform/bundle.md',
      invocationCommand: 'cat "/tmp/repo/.throughline/bootstrap-prompt.md" | claude',
    },
  })),
  getBootstrapState: vi.fn(async (_projectId: string) => ({
    result: {
      throughlineDir: 'absent' as const,
      promptRendered: false,
      pendingOutput: false,
      lastIngest: null as null | { at: string; counts: { new: number; reimported: number; conflict: number; stale_flagged: number } },
      archiveCount: 0,
      quarantineCount: 0,
      promptPath: null as string | null,
      outputPath: null as string | null,
    },
  })),

  // Phase 8 — methodology gate runtime (C-D6).
  listGateFirings: vi.fn(async (_projectId: string) => ({ groups: [] as GateMomentGroup[] })),
  runGateMoment: vi.fn(async (_projectId: string, _moment: string) => ({
    firings: [] as GateFiring[],
  })),
  overrideGateFiring: vi.fn(
    async (_projectId: string, firingId: string, reason: string) => ({
      firing: {
        id: firingId,
        project_id: 'p',
        moment: 'pre-write',
        gate_id: 'g',
        status: 'fail',
        findings: {
          check: 'banned-string',
          summary: 's',
          items: [],
          override: { reason, original_findings_ref: firingId, at: new Date().toISOString() },
        },
        created_at: new Date().toISOString(),
      } as GateFiring,
    }),
  ),

  // Phase 14 — personal RAG (T-D25). Default to a text answer with one citation.
  ragQuery: vi.fn(async (_projectId: string, req: { query: string; substrate?: string | null }) => ({
    substrate: req.substrate ?? 'text',
    routed_by: req.substrate ? 'override' : 'heuristic',
    answer: `mock answer for "${req.query}"`,
    citations: [{ substrate: req.substrate ?? 'text', ref: 'item:1', label: 'mock item', snippet: 'snip' }],
    used_ai: true,
    cross_project: false,
  })),
  reindexText: vi.fn(async (_projectId: string) => ({
    reembedded: 0,
    total: 0,
    embedder: 'fallback' as const,
  })),
  sessionRetro: vi.fn(
    async (_projectId: string, req: { session_id: string; attach_to_items?: boolean; append_to_session_start?: boolean }) => ({
      library_entry_id: 'lib1',
      summary: `retro for ${req.session_id}`,
      used_ai: true,
      attached_item_ids: req.attach_to_items ? ['i1'] : [],
      appended_to_session_start: req.append_to_session_start === true,
    }),
  ),
  getPeriodicReview: vi.fn(async (_projectId: string) => ({
    interval_days: 14,
    last_reviewed_at: null,
    due: true,
    buckets: [
      { category: 'code-drift', label: 'Open code-drift signals', count: 1, entries: [{ ref: 's1', detail: 'tier-2: drift' }] },
      { category: 'orphaned-rules', label: 'Orphaned verifier rules awaiting cleanup', count: 0, entries: [] },
    ],
  })),
  synthesizePeriodicReview: vi.fn(async (_projectId: string) => ({
    answer: 'Clean up the tier-2 signal first.',
    used_ai: true,
  })),
  getDoNext: vi.fn(async (_projectId: string) => ({
    sequence: [
      { id: 'c', title: 'C', ready: true, blocker_chain_depth: 0, downstream_unblocked: 2, gate_deprioritised: false, primary_unit_refs: [] },
      { id: 'a', title: 'A', ready: false, blocker_chain_depth: 2, downstream_unblocked: 0, gate_deprioritised: false, primary_unit_refs: [] },
    ],
    do_next: [
      { id: 'c', title: 'C', ready: true, blocker_chain_depth: 0, downstream_unblocked: 2, gate_deprioritised: false, primary_unit_refs: [] },
    ],
    unblock_impact: { if_you_unblock: ['c'], items_freed: 2 },
  })),
  getStakeholderView: vi.fn(async (_projectId: string, itemId: string) => ({
    item_id: itemId,
    rendered: `Plain-language summary of ${itemId}.`,
    used_ai: true,
    cached: false,
  })),
  getChatHistory: vi.fn(async (_projectId: string, contextType: string, contextId: string) => ({
    context_type: contextType === 'dump_zone' ? 'dump_zone' : 'session',
    context_id: contextId,
    messages: [] as Array<{ id: string; role: 'user' | 'assistant'; content: string; created_at: string }>,
  })),
  sendChat: vi.fn(
    async (_projectId: string, req: { context_id: string; message: string }) => ({
      user_message: { id: 'u1', role: 'user' as const, content: req.message, created_at: 't1' },
      assistant_message: { id: 'a1', role: 'assistant' as const, content: `re: ${req.message}`, created_at: 't2' },
      used_ai: true,
    }),
  ),
  proposeFromChat: vi.fn(async (_projectId: string, _req: unknown) => ({
    id: 'prop1',
    project_id: 'p1',
    target: 'session',
    source: 'paste',
    extractor: 'heuristic',
    raw_text: 'x',
    payload: { items: [] },
    status: 'pending',
    created_at: 't',
  })),
};
