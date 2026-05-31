import type { FastifyInstance } from 'fastify';
import type { BackgroundJobsHealthResponse } from '@throughline/shared';
import type { JobHealthRegistry } from './job-health.js';

// Phase E E5 — background-job health route (C-D26; SF5-01/02/04). Exposes the per-loop
// health so a failing background job is observable rather than a silent catch-and-log.
// The in-context rendering of this state lands in E6 via the C-D25 visibility component.
export function registerJobHealthRoutes(app: FastifyInstance, registry: JobHealthRegistry): void {
  app.get('/api/background-jobs/health', async (): Promise<BackgroundJobsHealthResponse> => {
    return { jobs: registry.snapshot() };
  });
}
