import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, type Config } from '../src/config.js';
import { openDb, type DB } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { createMethodologyRegistry, type MethodologyRegistry } from '../src/methodology/loader.js';

export function makeTmpConfig(overrides: Partial<Config> = {}): Config & { cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'throughline-test-'));
  const methodologiesDir = join(dir, 'methodologies');
  const config = loadConfig({
    dataDir: dir,
    methodologiesDir,
    ...overrides,
  });
  return {
    ...config,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export interface TestBackend {
  db: DB;
  registry: MethodologyRegistry;
  config: Config;
  cleanup: () => Promise<void>;
}

export async function makeBackend(config: Config & { cleanup?: () => void }): Promise<TestBackend> {
  const db = openDb(config.dbPath);
  runMigrations(db);
  const registry = createMethodologyRegistry({
    db,
    methodologiesDir: config.methodologiesDir,
    watch: false,
  });
  return {
    db,
    registry,
    config,
    cleanup: async () => {
      await registry.stop();
      db.close();
      config.cleanup?.();
    },
  };
}
