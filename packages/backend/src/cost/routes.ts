import type { FastifyInstance } from 'fastify';
import type { CostScope } from '@throughline/shared';
import type { CostSummaryService } from './summary.js';

export function registerCostRoutes(app: FastifyInstance, cost: CostSummaryService): void {
  app.get<{ Querystring: { project_id?: string; scope?: string } }>(
    '/api/cost/summary',
    async (req) => {
      const q = req.query ?? {};
      const projectId = typeof q.project_id === 'string' && q.project_id.length > 0
        ? q.project_id
        : null;
      // Default to global when no project is supplied; explicit scope=project requires
      // a project_id to be meaningful (null project_id then means cross-project rows).
      const scope: CostScope =
        q.scope === 'project' || (q.scope !== 'global' && projectId !== null)
          ? 'project'
          : 'global';
      return cost.summary({ scope, projectId });
    },
  );
}
