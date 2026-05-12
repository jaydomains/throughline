import type { FastifyInstance } from 'fastify';
import type { MethodologyRegistry } from '../methodology/loader.js';

export function registerMethodologyRoutes(app: FastifyInstance, registry: MethodologyRegistry): void {
  app.get('/api/methodologies', async () => {
    return {
      methodologies: registry.list().map((result) => {
        if (result.status === 'loaded') {
          const gateCount = Object.values(result.bundle.state_machine.gates_by_moment).reduce(
            (n, gates) => n + (gates?.length ?? 0),
            0,
          );
          return {
            status: 'loaded' as const,
            bundle_id: result.bundle.bundle_id,
            identity: result.bundle.identity,
            has_primary_unit: result.bundle.project_layout.primary_unit !== null,
            has_gates: gateCount > 0,
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
