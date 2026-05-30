import type { FastifyInstance } from 'fastify';
import {
  type CodeTodoService,
} from './service.js';
import type { ProjectsService } from '../projects/service.js';

interface ScanBody {
  patterns?: string[];
}

export function registerCodeTodoRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: CodeTodoService,
): void {
  app.post<{ Params: { id: string }; Body: ScanBody }>(
    '/api/projects/:id/code-todo/scan',
    async (req, reply) => {
      if (!projects.get(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const result = await service.scan({
        project_id: req.params.id,
        ...(req.body?.patterns ? { patterns: req.body.patterns } : {}),
      });
      return { result };
    },
  );
}
