import { existsSync, readFileSync } from 'node:fs';

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
