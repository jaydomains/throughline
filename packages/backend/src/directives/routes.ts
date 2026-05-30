import type { FastifyInstance } from 'fastify';
import {
  isDirectiveKind,
  isDirectiveParentType,
  type DirectiveKind,
  type DirectiveParentType,
  type DirectivePayload,
} from '@throughline/shared';
import {
  type DirectivesService,
} from './service.js';
import type { ProjectsService } from '../projects/service.js';

interface CreateBody {
  parent_type?: DirectiveParentType;
  parent_id?: string;
  kind?: DirectiveKind;
  payload?: DirectivePayload;
}

interface UpdateBody {
  payload?: DirectivePayload;
}

export function registerDirectiveRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: DirectivesService,
): void {
  function requireProject(id: string): boolean {
    return projects.get(id) !== null;
  }

  app.get<{
    Params: { id: string };
    Querystring: { kind?: string; parentType?: string; parentId?: string };
  }>('/api/projects/:id/directives', async (req, reply) => {
    if (!requireProject(req.params.id)) {
      return reply.code(404).send({ error: 'project_not_found' });
    }
    const { kind, parentType, parentId } = req.query;
    const filter: Parameters<DirectivesService['list']>[0] = { projectId: req.params.id };
    if (kind !== undefined) {
      if (!isDirectiveKind(kind)) return reply.code(400).send({ error: 'invalid_kind' });
      filter.kind = kind;
    }
    if (parentType !== undefined) {
      if (!isDirectiveParentType(parentType))
        return reply.code(400).send({ error: 'invalid_parent_type' });
      filter.parentType = parentType;
    }
    if (parentId !== undefined) filter.parentId = parentId;
    return { directives: service.list(filter) };
  });

  app.get<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/items/:itemId/directives',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return { directives: service.listForParent('item', req.params.itemId) };
    },
  );

  app.get<{ Params: { id: string; entryId: string } }>(
    '/api/projects/:id/library/:entryId/directives',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return { directives: service.listForParent('library', req.params.entryId) };
    },
  );

  app.post<{ Params: { id: string }; Body: CreateBody }>(
    '/api/projects/:id/directives',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const body = req.body ?? {};
      if (!body.kind) return reply.code(400).send({ error: 'kind_required' });
      if (!body.parent_type) return reply.code(400).send({ error: 'parent_type_required' });
      if (typeof body.parent_id !== 'string' || body.parent_id.length === 0) {
        return reply.code(400).send({ error: 'parent_id_required' });
      }
      const directive = service.create({
        project_id: req.params.id,
        parent_type: body.parent_type,
        parent_id: body.parent_id,
        kind: body.kind,
        ...(body.payload !== undefined ? { payload: body.payload } : {}),
      });
      return reply.code(201).send({ directive });
    },
  );

  app.patch<{ Params: { id: string; directiveId: string }; Body: UpdateBody }>(
    '/api/projects/:id/directives/:directiveId',
    async (req, reply) => {
      const existing = service.get(req.params.directiveId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      const directive = service.update(req.params.directiveId, req.body ?? {});
      return { directive };
    },
  );

  app.delete<{ Params: { id: string; directiveId: string } }>(
    '/api/projects/:id/directives/:directiveId',
    async (req, reply) => {
      const existing = service.get(req.params.directiveId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      service.delete(req.params.directiveId);
      return reply.code(204).send();
    },
  );
}
