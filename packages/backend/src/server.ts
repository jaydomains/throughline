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
import { createDirectivesService } from './directives/service.js';
import { registerDirectiveRoutes } from './directives/routes.js';
import { createReminderScheduler, type ReminderScheduler } from './directives/scheduler.js';
import { createOsNotifier } from './notifier/index.js';
import {
  createAnthropicSummariser,
  createHeuristicSummariser,
  createRoutingSummariser,
} from './md-ingest/summariser.js';
import { createMdIngestService } from './md-ingest/service.js';
import { registerMdIngestRoutes } from './md-ingest/routes.js';
import { createMdIngestWatcher, type MdIngestWatcher } from './md-ingest/watcher.js';

export interface ServerHandle {
  app: FastifyInstance;
  db: DB;
  registry: MethodologyRegistry;
  inboxWatcher: InboxWatcher;
  reminderScheduler: ReminderScheduler;
  mdIngestWatcher: MdIngestWatcher;
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
  const directives = createDirectivesService(db, projects, items, library);
  const notifier = createOsNotifier({
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
    },
  });
  // Phase 6c — repo `.md` ingestion. Summariser routes to Sonnet when the key is present
  // (heuristic fallback otherwise), same as the dump-zone extractor. The watcher mirrors
  // tracked-source entries on file change.
  const mdSummariser = createRoutingSummariser({
    anthropic: createAnthropicSummariser({ client: anthropicClient }),
    heuristic: createHeuristicSummariser(),
    client: anthropicClient,
  });
  const mdIngest = createMdIngestService({
    db,
    projects,
    library,
    summariser: mdSummariser,
  });
  const mdIngestWatcher = createMdIngestWatcher({
    projects,
    service: mdIngest,
    watch: watchInbox,
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
      error: (m) => app.log.error(m),
    },
  });
  const reminderScheduler = createReminderScheduler({
    db,
    service: directives,
    notifier,
    items,
    library,
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
      error: (m) => app.log.error(m),
    },
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
  registerDirectiveRoutes(app, projects, directives);
  registerMdIngestRoutes(app, projects, mdIngest);
  // Static-serve registers a catch-all and must come last so API routes win.
  if (serveFrontend) registerWebRoutes(app);

  reminderScheduler.start();
  mdIngestWatcher.start();

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
    reminderScheduler,
    mdIngestWatcher,
    url,
    close: async () => {
      reminderScheduler.stop();
      await app.close();
      await inboxWatcher.stop();
      await mdIngestWatcher.stop();
      await registry.stop();
      db.close();
    },
  };
}
