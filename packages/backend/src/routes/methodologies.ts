import type { FastifyInstance } from 'fastify';
import type { MethodologyRegistry } from '../methodology/loader.js';

export function registerMethodologyRoutes(app: FastifyInstance, registry: MethodologyRegistry): void {
  app.get('/api/methodologies', async () => {
    return {
      methodologies: registry.list().map((result) => {
        if (result.status === 'loaded') {
          return {
            status: 'loaded' as const,
            bundle_id: result.bundle.bundle_id,
            identity: result.bundle.identity,
          };
        }
        return {
          status: 'error' as const,
          bundle_id: result.bundle_id,
          errors: result.errors,
        };
      }),
    };
  });
}
