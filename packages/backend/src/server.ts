import Fastify, { type FastifyInstance } from 'fastify';
import { mkdirSync } from 'node:fs';
import type { Config } from './config.js';
import { openDb, type DB } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { createMethodologyRegistry, type MethodologyRegistry } from './methodology/loader.js';
import { createProjectsService } from './projects/service.js';
import { registerProjectRoutes } from './projects/routes.js';
import { registerSettingsRoutes } from './settings/routes.js';
import { createSettingsService } from './settings/service.js';
import { registerMethodologyRoutes } from './routes/methodologies.js';
import { registerHealthRoute } from './routes/health.js';
import { registerEventsRoute } from './routes/events.js';
import { registerWebRoutes } from './routes/web.js';

export interface ServerHandle {
  app: FastifyInstance;
  db: DB;
  registry: MethodologyRegistry;
  url: string;
  close: () => Promise<void>;
}

export interface StartServerOptions {
  serveFrontend?: boolean;
}

export async function startServer(
  config: Config,
  options: StartServerOptions = {},
): Promise<ServerHandle> {
  const { serveFrontend = true } = options;

  mkdirSync(config.dataDir, { recursive: true });
  mkdirSync(config.inboxDir, { recursive: true });
  mkdirSync(config.archiveDir, { recursive: true });
  mkdirSync(config.failuresDir, { recursive: true });

  const db = openDb(config.dbPath);
  runMigrations(db);

  const app = Fastify({ logger: true });
  const registry = createMethodologyRegistry({
    db,
    methodologiesDir: config.methodologiesDir,
    watch: true,
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
      error: (m) => app.log.error(m),
    },
  });
  const projects = createProjectsService(db, registry);
  const settings = createSettingsService(db);

  registerHealthRoute(app);
  registerEventsRoute(app);
  registerMethodologyRoutes(app, registry);
  registerProjectRoutes(app, projects, settings);
  registerSettingsRoutes(app, settings);
  // Static-serve registers a catch-all and must come last so API routes win.
  if (serveFrontend) registerWebRoutes(app);

  await app.listen({ host: config.host, port: config.port });
  // Derive the bound port from the listening socket so callers requesting port 0
  // (tests) get a working URL.
  const addr = app.server.address();
  const boundPort =
    typeof addr === 'object' && addr !== null && 'port' in addr ? addr.port : config.port;
  const url = `http://${config.host}:${boundPort}`;

  return {
    app,
    db,
    registry,
    url,
    close: async () => {
      await app.close();
      await registry.stop();
      db.close();
    },
  };
}
