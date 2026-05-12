import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve install root: where methodologies/ ships. From this file (src/config.ts at dev,
// dist/config.js at build) the repo root is three directories up.
function resolveInstallRoot(): string {
  const override = process.env.THROUGHLINE_INSTALL_ROOT;
  if (override) return resolve(override);
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..');
}

export interface Config {
  dataDir: string;
  dbPath: string;
  secretsPath: string;
  inboxDir: string;
  archiveDir: string;
  failuresDir: string;
  installRoot: string;
  methodologiesDir: string;
  port: number;
  host: string;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const dataDir = overrides.dataDir ?? process.env.THROUGHLINE_DATA_DIR ?? join(homedir(), '.throughline');
  const installRoot = overrides.installRoot ?? resolveInstallRoot();
  const methodologiesDir =
    overrides.methodologiesDir ?? process.env.THROUGHLINE_METHODOLOGIES_DIR ?? join(installRoot, 'methodologies');

  return {
    dataDir,
    dbPath: overrides.dbPath ?? join(dataDir, 'throughline.db'),
    secretsPath: overrides.secretsPath ?? join(dataDir, 'secrets.json'),
    inboxDir: overrides.inboxDir ?? join(dataDir, 'inbox'),
    archiveDir: overrides.archiveDir ?? join(dataDir, 'inbox-archive'),
    failuresDir: overrides.failuresDir ?? join(dataDir, 'inbox-failures'),
    installRoot,
    methodologiesDir,
    port: overrides.port ?? Number(process.env.THROUGHLINE_PORT ?? 47823),
    host: overrides.host ?? '127.0.0.1', // T-D31 — backend mediates external network; bind local only.
  };
}
