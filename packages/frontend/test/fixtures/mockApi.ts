import { vi } from 'vitest';
import type {
  ApplyRequest,
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
  LibrarySearchRequest,
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
  UpdateItemInput,
  UpdateLibraryEntryInput,
  UpdateSessionInput,
} from '@throughline/shared';
import { renderPromptBody } from '@throughline/shared';

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
}

const DEFAULT_PROJECT: Project = {
  id: 'p1',
  name: 'demo',
  repo_path: '/tmp/demo',
  github_owner: null,
  github_repo: null,
  bundle_id: 'freeform',
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
  boards: [{ id: 'tasks', label: 'Tasks', type: 'task' }],
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
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...entry,
  });
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
    session_ids: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
    ...i,
  });
}

export const mockApi = {
  health: vi.fn(async () => ({ ok: true, version: 'test' })),
  listProjects: vi.fn(async () => ({ projects: [...state.projects] })),
  createProject: vi.fn(async (input: CreateProjectInput) => {
    const project: Project = {
      id: id('p'),
      name: input.name,
      repo_path: input.repo_path,
      github_owner: input.github_owner ?? null,
      github_repo: input.github_repo ?? null,
      bundle_id: input.bundle_id ?? 'freeform',
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
  getPolicy: vi.fn(async (_projectId: string) => ({ policy: FREEFORM_POLICY })),

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
      session_ids: input.session_ids ?? [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.items.push(item);
    return { item };
  }),
  updateItem: vi.fn(async (_pid: string, itemId: string, input: UpdateItemInput) => {
    const item = state.items.find((x) => x.id === itemId);
    if (!item) throw new Error('not found');
    Object.assign(item, input);
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
        session_ids: itemProposal.target_session_id ? [itemProposal.target_session_id] : [],
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
            session_ids: input.diff.session_id ? [input.diff.session_id] : [],
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
};
