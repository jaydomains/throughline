import type { FastifyInstance } from 'fastify';
import type { LibraryEntryType } from '@throughline/shared';
import {
  LibraryEntryTypeError,
  ProjectNotFoundError,
  type LibraryService,
} from './service.js';
import type { ProjectsService } from '../projects/service.js';

interface CreateBody {
  type?: LibraryEntryType;
  title?: string;
  body?: string;
  tags?: string[];
}

export function registerLibraryRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: LibraryService,
): void {
  function requireProject(id: string): boolean {
    return projects.get(id) !== null;
  }

  app.get<{ Params: { id: string } }>('/api/projects/:id/library', async (req, reply) => {
    if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
    return { entries: service.list(req.params.id) };
  });

  app.get<{ Params: { id: string; entryId: string } }>(
    '/api/projects/:id/library/:entryId',
    async (req, reply) => {
      const entry = service.get(req.params.entryId);
      if (!entry || entry.project_id !== req.params.id) return reply.code(404).send({ error: 'not_found' });
      return { entry };
    },
  );

  app.post<{ Params: { id: string }; Body: CreateBody }>(
    '/api/projects/:id/library',
    async (req, reply) => {
      if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
      const body = req.body ?? {};
      if (typeof body.title !== 'string' || body.title.length === 0) {
        return reply.code(400).send({ error: 'title_required' });
      }
      if (!body.type) return reply.code(400).send({ error: 'type_required' });
      try {
        const entry = service.create({
          project_id: req.params.id,
          type: body.type,
          title: body.title,
          ...(body.body !== undefined ? { body: body.body } : {}),
          ...(body.tags !== undefined ? { tags: body.tags } : {}),
        });
        return reply.code(201).send({ entry });
      } catch (err) {
        if (err instanceof LibraryEntryTypeError) return reply.code(400).send({ error: 'invalid_type' });
        if (err instanceof ProjectNotFoundError) return reply.code(404).send({ error: 'project_not_found' });
        throw err;
      }
    },
  );
}
