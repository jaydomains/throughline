import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async () => {
    return { ok: true, version: '0.0.0' };
  });
}
