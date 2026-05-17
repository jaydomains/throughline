import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// T-D4: API keys live in a file separate from the datastore, never returned to the browser,
// never included in backups. Read on demand; do not cache the file content in memory longer
// than the call requires.

export interface Secrets {
  anthropic_api_key?: string;
  github_pat?: string;
}

export function readSecrets(secretsPath: string): Secrets {
  if (!existsSync(secretsPath)) return {};
  try {
    const raw = readFileSync(secretsPath, 'utf8');
    const parsed = JSON.parse(raw) as Secrets;
    return parsed;
  } catch {
    return {};
  }
}

// Phase 15 (T-D4) — the settings panel needs a write path. A present string field is
// upserted; an empty string clears that secret; an absent field leaves it untouched.
// Written 0600 so the key file is not group/world-readable.
export function writeSecrets(secretsPath: string, patch: Partial<Secrets>): void {
  const current = readSecrets(secretsPath);
  const next: Secrets = { ...current };
  for (const key of ['anthropic_api_key', 'github_pat'] as const) {
    const v = patch[key];
    if (v === undefined) continue;
    if (v === '') delete next[key];
    else next[key] = v;
  }
  mkdirSync(dirname(secretsPath), { recursive: true });
  writeFileSync(secretsPath, JSON.stringify(next, null, 2), { mode: 0o600 });
}

export interface SecretsPresence {
  anthropic_api_key: boolean;
  github_pat: boolean;
}

export function secretsPresence(secretsPath: string): SecretsPresence {
  const s = readSecrets(secretsPath);
  return {
    anthropic_api_key: typeof s.anthropic_api_key === 'string' && s.anthropic_api_key.length > 0,
    github_pat: typeof s.github_pat === 'string' && s.github_pat.length > 0,
  };
}
