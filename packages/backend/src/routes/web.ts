import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

// Phase 2: serve the built frontend SPA at `/`. Backend's static-serve resolves
// from a few candidate paths so dev / build / install layouts all work without
// extra plumbing.
//
// Priority order:
//   1. THROUGHLINE_FRONTEND_DIST env override
//   2. packages/frontend/dist relative to the backend source (dev / build)
//
// If no built frontend exists, serve a small HTML stub so visiting `/` in dev
// (with the Vite dev server on 5173) tells the user where to go.

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveFrontendDist(): string | null {
  const override = process.env.THROUGHLINE_FRONTEND_DIST;
  if (override) {
    const abs = resolve(override);
    return existsSync(join(abs, 'index.html')) ? abs : null;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  // From packages/backend/src or packages/backend/dist, the frontend lives at
  // ../../frontend/dist relative to the package root.
  const candidates = [
    resolve(here, '..', '..', '..', 'frontend', 'dist'),
    resolve(here, '..', '..', 'frontend', 'dist'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'index.html'))) return c;
  }
  return null;
}

const DEV_STUB = `<!doctype html>
<html><head><meta charset="utf-8"><title>Throughline</title></head>
<body style="font-family:-apple-system,Segoe UI,sans-serif;padding:32px;max-width:640px">
  <h1>Throughline backend is running.</h1>
  <p>The frontend is not built. Either run the Vite dev server:</p>
  <pre>pnpm --filter @throughline/frontend dev</pre>
  <p>and visit <a href="http://127.0.0.1:5173">http://127.0.0.1:5173</a>, or build the frontend:</p>
  <pre>pnpm --filter @throughline/frontend build</pre>
  <p>Then reload this page.</p>
</body></html>`;

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'ENOENT'
  );
}

export function registerWebRoutes(app: FastifyInstance): void {
  const distDir = resolveFrontendDist();

  if (!distDir) {
    app.log.warn('frontend dist not found; serving dev stub at /. Set THROUGHLINE_FRONTEND_DIST to override.');
    app.get('/', async (_req, reply) => reply.type('text/html').send(DEV_STUB));
    return;
  }

  app.log.info(`frontend dist: ${distDir}`);
  // Startup-time read is single-shot — sync is fine here and avoids a top-level
  // await. Per-request reads below use the async API so the event loop stays
  // unblocked.
  const indexPath = join(distDir, 'index.html');
  const indexHtml = readFileSync(indexPath, 'utf8');

  // Asset paths: try to serve a real file; otherwise fall back to index.html so
  // client-side routes (e.g. /projects/abc) work on direct navigation.
  app.get('/*', async (req, reply) => {
    const url = req.raw.url ?? '/';
    // Never intercept API or SSE.
    if (url.startsWith('/api/') || url === '/events' || url === '/health') {
      return reply.code(404).send({ error: 'not_found' });
    }

    const pathname = url.split('?')[0] ?? '/';
    if (pathname === '/' || pathname === '') {
      return reply.type('text/html').send(indexHtml);
    }

    // Resolve under distDir; reject path traversal.
    const safe = normalize(pathname).replace(/^\/+/, '');
    const candidate = join(distDir, safe);
    if (!candidate.startsWith(distDir + '/') && candidate !== distDir) {
      return reply.type('text/html').send(indexHtml);
    }
    try {
      const content = await readFile(candidate);
      const ext = extname(candidate).toLowerCase();
      const mime = MIME[ext] ?? 'application/octet-stream';
      return reply.type(mime).send(content);
    } catch (err) {
      if (isEnoent(err)) {
        return reply.type('text/html').send(indexHtml);
      }
      throw err;
    }
  });
}
