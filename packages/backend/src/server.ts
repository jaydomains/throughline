import Fastify, { type FastifyInstance } from 'fastify';
import { mkdirSync } from 'node:fs';
import type { Config } from './config.js';
import { openDb, type DB } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { createMethodologyRegistry, type MethodologyRegistry } from './methodology/loader.js';
import { createGateRuntime } from './methodology/gates/runtime.js';
import { createAnthropicJudgementGate } from './methodology/gates/judgement.js';
import { registerGateRoutes } from './methodology/gates/routes.js';
import { createGateHookQueue } from './methodology/gates/hook-queue.js';
import { writeRuntimeFile } from './methodology/gates/runtime-file.js';
import { installGateHooks } from './methodology/gates/hook-installer.js';
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
import { createDisciplineDriftEngine } from './methodology/drift/discipline/engine.js';
import { registerDisciplineDriftRoutes } from './methodology/drift/routes.js';
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
  mkdirSync(config.gateHookQueueDir, { recursive: true });
  mkdirSync(config.gateHookFailuresDir, { recursive: true });

  const db = openDb(config.dbPath);
  runMigrations(db);

  const app = Fastify({ logger: true });
  // Late-bound so the registry's reload hook can reach the discipline-drift engine, which
  // is constructed after the registry (C-D7). The registry's initial scan runs before any
  // project exists, so the optional-chained no-op is correct there.
  let disciplineEngine: ReturnType<typeof createDisciplineDriftEngine> | undefined;
  const registry = createMethodologyRegistry({
    db,
    methodologiesDir: config.methodologiesDir,
    watch: true,
    onBundleReloaded: (bundleId, projectIds) =>
      disciplineEngine?.reloadForBundle(bundleId, projectIds),
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
      error: (m) => app.log.error(m),
    },
  });
  const projects = createProjectsService(db, registry);
  // C-D14 — re-attach external bundle watch targets for projects already on disk.
  for (const p of projects.list({ includeArchived: true })) {
    if (p.bundle_path) registry.registerProjectBundle(p.id, p.bundle_id, p.bundle_path);
  }
  const settings = createSettingsService(db);
  const sessions = createSessionsService(db, projects);
  const drift = createDriftService(db);

  // Phase 9 — discipline-drift engine (C-D7). Constructed before the gate runtime so the
  // pre-write moment's onMoment hook can fire write-time scanners (SPEC §7.14).
  disciplineEngine = createDisciplineDriftEngine({
    db,
    projects,
    registry,
    drift,
    watch: watchInbox,
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
      error: (m) => app.log.error(m),
    },
  });
  const disciplineDrift = disciplineEngine;

  // AI / dump-zone: Anthropic client routes to the real Sonnet extractor when the secrets
  // file holds a key; heuristic fallback runs otherwise. Read availability per call so a
  // settings change doesn't require a backend restart.
  const anthropicClient = createAnthropicClient({ secretsPath: config.secretsPath });

  // Phase 8 — gate runtime is constructed before items so an item state transition can
  // fire the internal per-commit moment (SPEC §7.12, C-D6).
  const gateRuntime = createGateRuntime({
    db,
    projects,
    registry,
    judgement: createAnthropicJudgementGate({ client: anthropicClient }),
    // C-D7 — the pre-write moment also fires write-time discipline-drift scanners,
    // reusing the Phase-8 dispatch rather than duplicating trigger logic.
    onMoment: (projectId, moment) => {
      if (moment === 'pre-write') disciplineDrift.runScan(projectId, new Set(['pre-write']));
    },
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
      error: (m) => app.log.error(m),
    },
  });
  const items = createItemsService(db, projects, registry, {
    onStatusTransition: (projectId) => gateRuntime.onItemStatusTransition(projectId),
  });
  const library = createLibraryService(db, projects);
  const scratchpad = createScratchpadService(db);
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
  registerGateRoutes(app, {
    db,
    projects,
    runtime: gateRuntime,
    runtimeFilePath: config.runtimeFilePath,
    queueDir: config.gateHookQueueDir,
  });
  registerDisciplineDriftRoutes(app, { projects, drift, engine: disciplineDrift });
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
  registerMdIngestRoutes(app, projects, mdIngest, mdIngestWatcher);
  // Static-serve registers a catch-all and must come last so API routes win.
  if (serveFrontend) registerWebRoutes(app);

  reminderScheduler.start();
  mdIngestWatcher.start();
  disciplineDrift.start();

  await app.listen({ host: config.host, port: config.port });
  // Derive the bound port from the listening socket so callers requesting port 0
  // (tests) get a working URL.
  const addr = app.server.address();
  const boundPort =
    typeof addr === 'object' && addr !== null && 'port' in addr ? addr.port : config.port;
  const url = `http://${config.host}:${boundPort}`;

  // CODE_SPEC §7 — publish the bound URL so port-agnostic hook scripts can find the
  // backend at fire time (a port change needs no hook reinstall).
  writeRuntimeFile(config.runtimeFilePath, url);

  // Re-install hooks for projects that consented (settings_json.install_gate_hooks),
  // keeping the scripts current; failure is non-fatal (SPEC §7.12).
  for (const p of projects.list({ includeArchived: true })) {
    if (p.settings_json?.install_gate_hooks === true) {
      installGateHooks({
        repoPath: p.repo_path,
        runtimeFilePath: config.runtimeFilePath,
        queueDir: config.gateHookQueueDir,
      });
    }
  }

  // CODE_SPEC §7 — drain durable git-hook events that fired while the backend was down,
  // before serving traffic depends on them. The HTTP server is already listening; the
  // drain dispatches retroactively and is idempotent per event file.
  const hookQueue = createGateHookQueue({
    queueDir: config.gateHookQueueDir,
    failuresDir: config.gateHookFailuresDir,
    runtime: gateRuntime,
    logger: {
      info: (m) => app.log.info(m),
      warn: (m) => app.log.warn(m),
      error: (m) => app.log.error(m),
    },
  });
  await hookQueue.drain();

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
      await disciplineDrift.stop();
      await registry.stop();
      db.close();
    },
  };
}
