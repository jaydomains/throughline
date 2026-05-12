import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { secretsPresence } from '../secrets/store.js';

export function registerHealthRoute(app: FastifyInstance, config: Config): void {
  app.get('/health', async () => {
    return {
      ok: true,
      version: '0.0.0',
      data_dir: config.dataDir,
      methodologies_dir: config.methodologiesDir,
      secrets: secretsPresence(config.secretsPath),
    };
  });
}
