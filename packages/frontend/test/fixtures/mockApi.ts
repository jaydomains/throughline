import { vi } from 'vitest';
import type {
  AuditEntry,
  CreateItemInput,
  CreateSessionInput,
  Item,
  ItemPolicy,
  Session,
  UpdateItemInput,
  UpdateSessionInput,
} from '@throughline/shared';

interface State {
  sessions: Session[];
  items: Item[];
  audit: AuditEntry[];
  settings: Record<string, unknown>;
}

const state: State = {
  sessions: [],
  items: [],
  audit: [],
  settings: { stale_threshold_days: 14, last_active_project_id: 'p1' },
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
  state.sessions = [];
  state.items = [];
  state.audit = [];
  state.settings = { stale_threshold_days: 14, last_active_project_id: 'p1' };
  counter = 0;
  for (const fn of Object.values(mockApi)) {
    if (typeof fn === 'function' && 'mockClear' in fn) (fn as { mockClear: () => void }).mockClear();
  }
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
  listProjects: vi.fn(async () => ({
    projects: [
      {
        id: 'p1',
        name: 'demo',
        repo_path: '/tmp/demo',
        github_owner: null,
        github_repo: null,
        bundle_id: 'freeform',
        state: 'active' as const,
        settings_json: {},
        created_at: '',
        updated_at: '',
        archived_at: null,
      },
    ],
  })),
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
};
