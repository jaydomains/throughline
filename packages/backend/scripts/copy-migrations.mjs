// Non-TS assets that the backend reads at runtime relative to its compiled
// location. tsc does not copy these — mirror them into dist/ after compile.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// .sql migration files alongside migrate.ts.
const migrationsSrc = join(here, '..', 'src', 'db', 'migrations');
const migrationsDest = join(here, '..', 'dist', 'db', 'migrations');
mkdirSync(migrationsDest, { recursive: true });
cpSync(migrationsSrc, migrationsDest, { recursive: true });

// Phase 21 (C-D21, T-D55) — bootstrap prompt template loaded by render.ts
// via `import.meta.url + readFileSync`. Same pattern as the migrations: lives
// in src/, must be mirrored into dist/ so the production layout resolves.
const templateSrc = join(here, '..', 'src', 'bootstrap', 'prompt-template.md');
const templateDest = join(here, '..', 'dist', 'bootstrap', 'prompt-template.md');
mkdirSync(dirname(templateDest), { recursive: true });
cpSync(templateSrc, templateDest);
