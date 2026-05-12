import { loadConfig } from './config.js';
import { startServer } from './server.js';

const config = loadConfig();
const handle = await startServer(config);
handle.app.log.info(`Throughline backend listening on ${handle.url}`);

const shutdown = async (signal: string) => {
  handle.app.log.info(`received ${signal}, shutting down`);
  await handle.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
