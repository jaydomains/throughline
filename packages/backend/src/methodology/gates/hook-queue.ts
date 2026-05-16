import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { PhaseMoment } from '@throughline/shared';
import type { GateRuntime } from './runtime.js';

// CODE_SPEC §7 — durable git-hook event queue. When a hook fires and the backend is
// unreachable, the hook writes one JSON file per event here. On startup the backend
// drains the directory before serving: dispatch, then delete on success or move to
// failures/ with an .error.json companion. Mirrors the Phase 4 inbox worker's
// serial-drain + quarantine idioms (T-D37 — internal Throughline-managed file moves).

export interface HookEvent {
  moment: PhaseMoment;
  repo_path: string;
  head_sha?: string;
  fired_at: string;
}

export interface GateHookQueue {
  drain(): Promise<void>;
}

export interface GateHookQueueOptions {
  queueDir: string;
  failuresDir: string;
  runtime: GateRuntime;
  logger?: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
}

const HOOK_MOMENTS: ReadonlySet<string> = new Set(['per-commit', 'post-commit']);

export function createGateHookQueue(opts: GateHookQueueOptions): GateHookQueue {
  const { queueDir, failuresDir, runtime, logger } = opts;

  function quarantine(file: string, error: string): void {
    if (!existsSync(failuresDir)) mkdirSync(failuresDir, { recursive: true });
    const target = join(failuresDir, file);
    try {
      renameSync(join(queueDir, file), target);
    } catch {
      /* best-effort move; still drop the error companion below */
    }
    writeFileSync(
      target + '.error.json',
      JSON.stringify({ error, quarantined_at: new Date().toISOString() }, null, 2),
      'utf8',
    );
    logger?.warn(`gate hook event quarantined: ${file} (${error})`);
  }

  async function drain(): Promise<void> {
    if (!existsSync(queueDir)) return;
    const files = readdirSync(queueDir)
      .filter((f) => f.endsWith('.json'))
      .sort(); // <timestamp>-<nanoid>.json — lexical sort is chronological.
    // Serial drain: gate dispatch may spawn scripts or call Anthropic; running events in
    // parallel risks rate-limiting and obscures ordering of retroactive firings.
    for (const file of files) {
      let event: HookEvent;
      try {
        event = JSON.parse(readFileSync(join(queueDir, file), 'utf8')) as HookEvent;
      } catch (e) {
        quarantine(file, `unparseable: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      if (!HOOK_MOMENTS.has(event.moment) || !event.repo_path) {
        quarantine(file, `invalid hook event (moment=${event.moment})`);
        continue;
      }
      try {
        const dispatchInput: Parameters<GateRuntime['dispatch']>[1] = {
          repoPath: event.repo_path,
        };
        if (event.head_sha) dispatchInput.headSha = event.head_sha;
        const { firings } = await runtime.dispatch(event.moment, dispatchInput);
        if (firings.length === 0) {
          logger?.info(`gate hook event ${file}: no project/gates resolved; dropping`);
        }
        rmSync(join(queueDir, file), { force: true });
      } catch (e) {
        quarantine(file, `dispatch failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return { drain };
}
