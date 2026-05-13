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
import { createItemsService } from './items/service.js';
import { registerItemRoutes } from './items/routes.js';
import { createSessionsService } from './sessions/service.js';
import { registerSessionRoutes } from './sessions/routes.js';
import { registerAuditRoutes } from './audit/routes.js';
import { registerMethodologyRoutes } from './routes/methodologies.js';
import { registerHealthRoute } from './routes/health.js';
import { registerEventsRoute } from './routes/events.js';
import { registerWebRoutes } from './routes/web.js';
import { createAnthropicClient } from './ai/anthropic.js';
import {
  createAnthropicExtractor,
  createHeuristicExtractor,
  createRoutingExtractor,
} from './dump-zone/extractor.js';
import { createDumpZoneService } from './dump-zone/service.js';
import { registerDumpZoneRoutes } from './dump-zone/routes.js';
import { createLibraryService } from './library/service.js';
import { registerLibraryRoutes } from './library/routes.js';
import { createScratchpadService } from './scratchpad/service.js';
import { registerScratchpadRoutes } from './scratchpad/routes.js';
import { createInboxWorker } from './inbox/worker.js';
import { createInboxWatcher, type InboxWatcher } from './inbox/watcher.js';
import { registerInboxRoutes } from './inbox/routes.js';
import { createCodeTodoService } from './code-todo/service.js';
import { registerCodeTodoRoutes } from './code-todo/routes.js';
import { createDriftService } from './drift/service.js';
import {
  createAnthropicReconcileEngine,
  createHeuristicReconcileEngine,
  createRoutingReconcileEngine,
} from './reconcile/engine.js';
import { createReconcileService } from './reconcile/service.js';
import { registerReconcileRoutes } from './reconcile/routes.js';

export interface ServerHandle {
  app: FastifyInstance;
  db: DB;
  registry: MethodologyRegistry;
  inboxWatcher: InboxWatcher;
  url: string;
  close: () => Promise<void>;
}

export interface StartServerOptions {
  serveFrontend?: boolean;
  watchInbox?: boolean;
}

export async function startServer(
  config: Config,
  options: StartServerOptions = {},
): Promise<ServerHandle> {
  const { serveFrontend = true, watchInbox = true } = options;

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
  const sessions = createSessionsService(db, projects);
  const items = createItemsService(db, projects, registry);
  const library = createLibraryService(db, projects);
  const scratchpad = createScratchpadService(db);

  // AI / dump-zone: Anthropic client routes to the real Sonnet extractor when the secrets
  // file holds a key; heuristic fallback runs otherwise. Read availability per call so a
  // settings change doesn't require a backend restart.
  const anthropicClient = createAnthropicClient({ secretsPath: config.secretsPath });
  const extractor = createRoutingExtractor({
    anthropic: createAnthropicExtractor({ client: anthropicClient }),
    heuristic: createHeuristicExtractor(),
    client: anthropicClient,
  });
  const dumpZone = createDumpZoneService({
    db,
    projects,
    registry,
    items,
    library,
    extractor,
  });
  const inboxWorker = createInboxWorker({
    db,
    projects,
    dumpZone,
    archiveDir: config.archiveDir,
    failuresDir: config.failuresDir,
    getLastActiveProjectId: () => {
      const v = settings.get('last_active_project_id');
      return typeof v === 'string' ? v : null;
    },
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
      error: (m) => app.log.error(m),
    },
  });
  const inboxWatcher = createInboxWatcher({
    inboxDir: config.inboxDir,
    worker: inboxWorker,
    watch: watchInbox,
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
      error: (m) => app.log.error(m),
    },
  });
  const codeTodo = createCodeTodoService({ db, projects, dumpZone });
  const drift = createDriftService(db);
  const reconcileEngine = createRoutingReconcileEngine({
    anthropic: createAnthropicReconcileEngine({ client: anthropicClient }),
    heuristic: createHeuristicReconcileEngine(),
    client: anthropicClient,
  });
  const reconcile = createReconcileService({
    db,
    projects,
    sessions,
    registry,
    items,
    drift,
    engine: reconcileEngine,
  });

  registerHealthRoute(app);
  registerEventsRoute(app);
  registerMethodologyRoutes(app, registry);
  registerProjectRoutes(app, projects, settings);
  registerSessionRoutes(app, projects, sessions);
  registerItemRoutes(app, projects, items);
  registerAuditRoutes(app, db);
  registerSettingsRoutes(app, settings);
  registerDumpZoneRoutes(app, projects, dumpZone);
  registerLibraryRoutes(app, projects, library);
  registerScratchpadRoutes(app, projects, scratchpad);
  registerInboxRoutes(app, inboxWorker, inboxWatcher);
  registerCodeTodoRoutes(app, projects, codeTodo);
  registerReconcileRoutes(app, projects, reconcile);
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
    inboxWatcher,
    url,
    close: async () => {
      await app.close();
      await inboxWatcher.stop();
      await registry.stop();
      db.close();
    },
  };
}
