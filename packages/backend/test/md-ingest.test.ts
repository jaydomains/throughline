import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProjectsService } from '../src/projects/service.js';
import { createLibraryService } from '../src/library/service.js';
import {
  EntryNotFoundError,
  FolderMissingError,
  FolderNotFoundError,
  FolderOutsideRepoError,
  NotAnImportedDocError,
  createMdIngestService,
} from '../src/md-ingest/service.js';
import {
  createAnthropicSummariser,
  createHeuristicSummariser,
  createRoutingSummariser,
} from '../src/md-ingest/summariser.js';
import type { AnthropicClient } from '../src/ai/anthropic.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

function plantFreeform(methodologiesDir: string): void {
  const target = join(methodologiesDir, 'freeform');
  mkdirSync(target, { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(target, 'bundle.md'));
}

function unavailableClient(): AnthropicClient {
  return { available: () => false, call: async () => { throw new Error('unused'); } };
}

function heuristicSummariser() {
  const client = unavailableClient();
  return createRoutingSummariser({
    anthropic: createAnthropicSummariser({ client }),
    heuristic: createHeuristicSummariser(),
    client,
  });
}

async function setup(opts: { summariser?: ReturnType<typeof heuristicSummariser> } = {}) {
  const cfg = makeTmpConfig();
  plantFreeform(cfg.methodologiesDir);
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const library = createLibraryService(backend.db, projects);
  // Repo lives inside the tmp data dir so the cleanup() removes it too.
  const repoPath = join(cfg.dataDir, 'repo');
  mkdirSync(join(repoPath, 'docs'), { recursive: true });
  const project = projects.create({ name: 'demo', repo_path: repoPath });
  const md = createMdIngestService({
    db: backend.db,
    projects,
    library,
    summariser: opts.summariser ?? heuristicSummariser(),
  });
  return { backend, projects, library, project, md, repoPath, db: backend.db };
}

describe('md-ingest service (Phase 6c — repo .md ingestion)', () => {
  it('adds a folder confined to repo_path and rejects escaping paths', async () => {
    const { backend, md, project } = await setup();
    try {
      const folder = md.addFolder(project.id, 'docs');
      expect(folder.rel_path).toBe('docs');
      expect(md.listFolders(project.id)).toHaveLength(1);
      // idempotent
      md.addFolder(project.id, 'docs');
      expect(md.listFolders(project.id)).toHaveLength(1);

      expect(() => md.addFolder(project.id, '../escape')).toThrow(FolderOutsideRepoError);
      expect(() => md.addFolder(project.id, '/etc')).toThrow(FolderOutsideRepoError);
      expect(() => md.addFolder(project.id, 'docs/missing')).toThrow(FolderMissingError);
    } finally {
      await backend.cleanup();
    }
  });

  it('scans for .md files and classifies new / unchanged / changed', async () => {
    const { backend, md, project, repoPath } = await setup();
    try {
      writeFileSync(join(repoPath, 'docs', 'a.md'), '# Title A\n\nFirst paragraph of A.');
      writeFileSync(join(repoPath, 'docs', 'b.md'), '# Title B\n\nBody B.');
      writeFileSync(join(repoPath, 'docs', 'ignore.txt'), 'not markdown');
      const folder = md.addFolder(project.id, 'docs');

      const scan1 = md.scan(project.id, folder.id);
      expect(scan1.candidates.map((c) => c.rel_path).sort()).toEqual([
        join('docs', 'a.md'),
        join('docs', 'b.md'),
      ]);
      expect(scan1.candidates.every((c) => c.status === 'new')).toBe(true);

      await md.ingest(project.id, { folder_id: folder.id, paths: [join('docs', 'a.md')] });
      const scan2 = md.scan(project.id, folder.id);
      const a = scan2.candidates.find((c) => c.rel_path === join('docs', 'a.md'))!;
      expect(a.status).toBe('unchanged');
      expect(a.entry_id).not.toBeNull();

      writeFileSync(join(repoPath, 'docs', 'a.md'), '# Title A\n\nEdited paragraph.');
      const scan3 = md.scan(project.id, folder.id);
      expect(scan3.candidates.find((c) => c.rel_path === join('docs', 'a.md'))!.status).toBe(
        'changed',
      );
    } finally {
      await backend.cleanup();
    }
  });

  it('ingest creates an imported_doc entry with summary + tags and audits', async () => {
    const { backend, md, project, library, db } = await setup();
    try {
      const { repoPath } = { repoPath: project.repo_path };
      writeFileSync(
        join(repoPath, 'docs', 'guide.md'),
        '# Guide\n\nThis explains the deployment process.',
      );
      const folder = md.addFolder(project.id, 'docs');
      const result = await md.ingest(project.id, {
        folder_id: folder.id,
        paths: [join('docs', 'guide.md')],
      });
      expect(result.ingested).toHaveLength(1);
      expect(result.ingested[0]!.status).toBe('created');
      const entry = library.get(result.ingested[0]!.entry_id)!;
      expect(entry.type).toBe('imported_doc');
      expect(entry.source_path).toBe(join('docs', 'guide.md'));
      expect(entry.source_tracked).toBe(false);
      expect(entry.summary).toContain('deployment');
      expect(entry.tags.length).toBeGreaterThan(0);
      expect(entry.body).toContain('# Guide');

      const audit = db
        .prepare("SELECT * FROM audit_log WHERE field = 'md_ingest'")
        .all() as Array<{ actor: string; entity_id: string }>;
      expect(audit).toHaveLength(1);
      expect(audit[0]!.entity_id).toBe(entry.id);
    } finally {
      await backend.cleanup();
    }
  });

  it('records cost telemetry + prompt fingerprint when the AI summariser runs', async () => {
    const client: AnthropicClient = {
      available: () => true,
      call: async () => ({
        text: JSON.stringify({ summary: 'AI summary of the doc.', tags: ['ai', 'doc'] }),
        input_tokens: 120,
        output_tokens: 30,
        stop_reason: 'end_turn',
      }),
    };
    const summariser = createRoutingSummariser({
      anthropic: createAnthropicSummariser({ client }),
      heuristic: createHeuristicSummariser(),
      client,
    });
    const { backend, md, project, library, db } = await setup({ summariser });
    try {
      writeFileSync(join(project.repo_path, 'docs', 'x.md'), '# X\n\nbody');
      const folder = md.addFolder(project.id, 'docs');
      const result = await md.ingest(project.id, {
        folder_id: folder.id,
        paths: [join('docs', 'x.md')],
      });
      const entry = library.get(result.ingested[0]!.entry_id)!;
      expect(entry.summary).toBe('AI summary of the doc.');
      expect(entry.tags).toEqual(['ai', 'doc']);

      const cost = db
        .prepare("SELECT * FROM cost_telemetry WHERE feature = 'md_ingest_summary'")
        .all() as Array<{ input_tokens: number; output_tokens: number; model: string }>;
      expect(cost).toHaveLength(1);
      expect(cost[0]!.input_tokens).toBe(120);

      const audit = db
        .prepare("SELECT trigger_context_json FROM audit_log WHERE field = 'md_ingest'")
        .get() as { trigger_context_json: string };
      const ctx = JSON.parse(audit.trigger_context_json) as Record<string, unknown>;
      expect(typeof ctx.prompt_fingerprint).toBe('string');
      expect(ctx.model).toBe('claude-sonnet-4-6');
    } finally {
      await backend.cleanup();
    }
  });

  it('setTracked toggles the per-entry flag; reingest is hash-gated', async () => {
    const { backend, md, project, library } = await setup();
    try {
      writeFileSync(join(project.repo_path, 'docs', 't.md'), 'v1 content');
      const folder = md.addFolder(project.id, 'docs');
      const ing = await md.ingest(project.id, {
        folder_id: folder.id,
        paths: [join('docs', 't.md')],
      });
      const entryId = ing.ingested[0]!.entry_id;

      const tracked = md.setTracked(project.id, entryId, true);
      expect(tracked.source_tracked).toBe(true);

      const noChange = await md.reingestEntry(project.id, entryId, 'user');
      expect(noChange.changed).toBe(false);

      writeFileSync(join(project.repo_path, 'docs', 't.md'), 'v2 content changed');
      const changed = await md.reingestEntry(project.id, entryId, 'system');
      expect(changed.changed).toBe(true);
      expect(library.get(entryId)!.body).toBe('v2 content changed');
    } finally {
      await backend.cleanup();
    }
  });

  it('ingest skips a symlinked file even if it passed scan (C-D10 TOCTOU)', async () => {
    const { backend, md, project, repoPath } = await setup();
    try {
      const { symlinkSync, writeFileSync, mkdirSync } = await import('node:fs');
      // A real doc plus a symlink pointing at a file outside the opted-in folder.
      writeFileSync(join(repoPath, 'docs', 'real.md'), '# Real\n\nlegit content');
      mkdirSync(join(repoPath, 'secret'), { recursive: true });
      writeFileSync(join(repoPath, 'secret', 'leak.md'), '# Leak\n\nsensitive');
      symlinkSync(
        join(repoPath, 'secret', 'leak.md'),
        join(repoPath, 'docs', 'link.md'),
      );
      const folder = md.addFolder(project.id, 'docs');

      const result = await md.ingest(project.id, {
        folder_id: folder.id,
        paths: [join('docs', 'real.md'), join('docs', 'link.md')],
      });
      expect(result.ingested.map((i) => i.rel_path)).toEqual([join('docs', 'real.md')]);
      // Typed skip reason (SF4-03): a symlink TOCTOU skip is distinct from missing/too-large.
      expect(result.skipped).toContainEqual({ rel_path: join('docs', 'link.md'), reason: 'symlink' });
    } finally {
      await backend.cleanup();
    }
  });

  it('guards: unknown folder, unknown entry, non-imported-doc entry', async () => {
    const { backend, md, project, library } = await setup();
    try {
      expect(() => md.scan(project.id, 'nope')).toThrow(FolderNotFoundError);
      await expect(
        md.reingestEntry(project.id, 'nope', 'user'),
      ).rejects.toThrow(EntryNotFoundError);
      const note = library.create({
        project_id: project.id,
        type: 'note',
        title: 'plain note',
      });
      expect(() => md.setTracked(project.id, note.id, true)).toThrow(NotAnImportedDocError);
    } finally {
      await backend.cleanup();
    }
  });
});

describe('E2 — md-ingest honesty (T-D60: SF4-02, SF4-03)', () => {
  it('ingested entry discloses the heuristic-fallback note when AI is absent (SF4-02)', async () => {
    const { backend, md, project, repoPath } = await setup(); // default = heuristic (no key)
    try {
      writeFileSync(join(repoPath, 'docs', 'a.md'), '# A\n\nsome prose here');
      const folder = md.addFolder(project.id, 'docs');
      const result = await md.ingest(project.id, {
        folder_id: folder.id,
        paths: [join('docs', 'a.md')],
      });
      expect(result.ingested).toHaveLength(1);
      // The summary-failure is disclosed on the entry, not silently presented as healthy.
      expect(result.ingested[0]!.extractor_note).toContain('Heuristic summariser used');
    } finally {
      await backend.cleanup();
    }
  });

  it('ingested entry discloses an AI-call-failure note distinctly from the no-key note (SF4-02)', async () => {
    const failing: AnthropicClient = {
      available: () => true,
      call: async () => {
        throw new Error('502 upstream');
      },
    };
    const summariser = createRoutingSummariser({
      anthropic: createAnthropicSummariser({ client: failing }),
      heuristic: createHeuristicSummariser(),
      client: failing,
    });
    const { backend, md, project, repoPath } = await setup({ summariser });
    try {
      writeFileSync(join(repoPath, 'docs', 'b.md'), '# B\n\nprose');
      const folder = md.addFolder(project.id, 'docs');
      const result = await md.ingest(project.id, {
        folder_id: folder.id,
        paths: [join('docs', 'b.md')],
      });
      expect(result.ingested[0]!.extractor_note).toContain('Anthropic call failed');
    } finally {
      await backend.cleanup();
    }
  });

  it('skipped reasons are typed and distinct: missing / too_large / outside_repo (SF4-03)', async () => {
    const { backend, md, project, repoPath } = await setup();
    try {
      writeFileSync(join(repoPath, 'docs', 'small.md'), '# ok');
      writeFileSync(join(repoPath, 'docs', 'big.md'), '# big\n\n' + 'x'.repeat(2_000_001));
      const folder = md.addFolder(project.id, 'docs');
      const result = await md.ingest(project.id, {
        folder_id: folder.id,
        paths: [
          join('docs', 'small.md'), // ingested
          join('docs', 'gone.md'), // never written ⇒ missing (deleted between scan + ingest)
          join('docs', 'big.md'), // exceeds the size cap ⇒ too_large
          join('..', 'escape.md'), // escapes repo_path ⇒ outside_repo
        ],
      });
      expect(result.ingested.map((i) => i.rel_path)).toEqual([join('docs', 'small.md')]);
      const byReason = Object.fromEntries(result.skipped.map((sk) => [sk.reason, sk.rel_path]));
      expect(byReason.missing).toBe(join('docs', 'gone.md'));
      expect(byReason.too_large).toBe(join('docs', 'big.md'));
      expect(byReason.outside_repo).toBe(join('..', 'escape.md'));
    } finally {
      await backend.cleanup();
    }
  });
});
