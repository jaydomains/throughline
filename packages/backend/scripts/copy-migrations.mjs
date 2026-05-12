// .sql files alongside migrate.ts are read at runtime relative to the compiled file's location.
// tsc does not copy non-TS assets — this script mirrors them into dist/db/migrations/.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src', 'db', 'migrations');
const dest = join(here, '..', 'dist', 'db', 'migrations');
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
