import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// CODE_SPEC §7 — port stability for hook scripts. The backend's bound port can change
// between runs; installed hook scripts must not embed it. The backend writes its current
// bound URL to a fixed runtime location on startup; hook scripts read it at fire time, so
// a port change requires no hook reinstall.

export function writeRuntimeFile(runtimeFilePath: string, url: string): void {
  const dir = dirname(runtimeFilePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    runtimeFilePath,
    JSON.stringify({ url, written_at: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

export function readRuntimeUrl(runtimeFilePath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(runtimeFilePath, 'utf8')) as { url?: string };
    return typeof parsed.url === 'string' ? parsed.url : null;
  } catch {
    return null;
  }
}
