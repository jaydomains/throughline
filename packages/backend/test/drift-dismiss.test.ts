import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DB } from '../src/db/index.js';
import { createProjectsService } from '../src/projects/service.js';
import { createDriftService } from '../src/drift/service.js';
import { makeBackend, makeTmpConfig } from './helpers.js';

const FREEFORM_BUNDLE_PATH = join(__dirname, '..', '..', '..', 'methodologies', 'freeform', 'bundle.md');

// S4-01 regression. dismissSignal's UPDATE is guarded by `dismissed_at IS NULL`, so the
// first reason already wins on the row. But the audit entry was appended unconditionally,
// so dismissing an already-dismissed signal (a verifier tier and a manual dismiss racing,
// or a re-scan) logged a spurious second dismissal — over-dismissal in the audit trail.
// The fix audits only the dismissal that actually changed a row.

async function setup() {
  const cfg = makeTmpConfig();
  mkdirSync(join(cfg.methodologiesDir, 'freeform'), { recursive: true });
  copyFileSync(FREEFORM_BUNDLE_PATH, join(cfg.methodologiesDir, 'freeform', 'bundle.md'));
  const backend = await makeBackend(cfg);
  const projects = createProjectsService(backend.db, backend.registry);
  const drift = createDriftService(backend.db);
  const project = projects.create({ name: 'p', repo_path: '/tmp/p-s4' });
  return { backend, drift, project };
}

function dismissAuditCount(db: DB, signalId: string): number {
  const rows = db
    .prepare(`SELECT new_value FROM audit_log WHERE field = 'drift_signal_dismiss'`)
    .all() as { new_value: string }[];
  return rows.filter((r) => r.new_value === signalId).length;
}

describe('S4-01 — dismissSignal is idempotent (no spurious over-dismissal)', () => {
  it('keeps the first reason and audits only the dismissal that actually happened', async () => {
    const { backend, drift, project } = await setup();
    try {
      const id = drift.createCodeSignal({
        projectId: project.id,
        itemId: null,
        category: 'tier-1',
        reason: 'verifier rule failing',
      });

      drift.dismissSignal(id, 'first reason');
      // A second dismiss (different reason) must be a no-op: it neither overwrites the
      // stored reason nor appends another audit row.
      drift.dismissSignal(id, 'second reason');

      const row = backend.db
        .prepare(`SELECT dismissed_at, dismiss_reason FROM drift_signals WHERE id = ?`)
        .get(id) as { dismissed_at: string | null; dismiss_reason: string | null };

      expect(row.dismissed_at).not.toBeNull();
      expect(row.dismiss_reason).toBe('first reason');
      expect(dismissAuditCount(backend.db, id)).toBe(1);
    } finally {
      await backend.cleanup();
    }
  });

  it('dismissing a non-existent signal is a silent no-op (no audit row)', async () => {
    const { backend, drift } = await setup();
    try {
      drift.dismissSignal('does-not-exist', 'whatever');
      expect(dismissAuditCount(backend.db, 'does-not-exist')).toBe(0);
    } finally {
      await backend.cleanup();
    }
  });
});
