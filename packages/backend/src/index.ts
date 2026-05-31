import { loadConfig } from './config.js';
import { startServer } from './server.js';

const config = loadConfig();
const handle = await startServer(config);
handle.app.log.info(`Throughline backend listening on ${handle.url}`);

// SF5-11 — global last-resort handlers so a stray rejection / exception is logged rather
// than vanishing (an unhandledRejection terminates the process on modern Node with no
// trace otherwise). Registered on the real process entry only (not in startServer, which
// the test suite builds repeatedly), so tests don't accumulate process listeners.
process.on('unhandledRejection', (reason) => {
  handle.app.log.error(
    `unhandledRejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
  );
});
process.on('uncaughtException', (err) => {
  handle.app.log.error(
    `uncaughtException: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
  );
});

const shutdown = async (signal: string) => {
  handle.app.log.info(`received ${signal}, shutting down`);
  await handle.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
