import type { FastifyInstance } from 'fastify';
import type { ItemsResponse, ItemResponse, PolicyResponse } from '@throughline/shared';
import {
  type ItemsService,
} from './service.js';
import type { ProjectsService } from '../projects/service.js';

export function registerItemRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  items: ItemsService,
): void {
  function requireProject(id: string): boolean {
    return projects.get(id) !== null;
  }

  app.get<{
    Params: { id: string };
    Querystring: { session_id?: string; parent_id?: string };
  }>('/api/projects/:id/items', async (req, reply) => {
    if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
    const { session_id, parent_id } = req.query;
    const filter: Parameters<ItemsService['list']>[0] = { project_id: req.params.id };
    if (session_id !== undefined) filter.session_id = session_id;
    if (parent_id !== undefined) filter.parent_id = parent_id === 'null' ? null : parent_id;
    const body: ItemsResponse = { items: items.list(filter) };
    return body;
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/policy', async (req, reply) => {
    if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
    const body: PolicyResponse = { policy: items.policy(req.params.id) };
    return body;
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/modules', async (req, reply) => {
    if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
    return items.modules(req.params.id);
  });

  app.get<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/items/:itemId',
    async (req, reply) => {
      const item = items.get(req.params.itemId);
      if (!item || item.project_id !== req.params.id) return reply.code(404).send({ error: 'not_found' });
      const body: ItemResponse = { item };
      return body;
    },
  );

  // Phase 17 (SPEC §7.17) — "Linked items" relations for the detail panel.
  app.get<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/items/:itemId/links',
    async (req, reply) => {
      const item = items.get(req.params.itemId);
      if (!item || item.project_id !== req.params.id) return reply.code(404).send({ error: 'not_found' });
      return { links: items.links(req.params.itemId)! };
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      title?: string;
      type?: string;
      status?: string;
      description?: string;
      blocker_text?: string | null;
      parent_id?: string | null;
      branch_ref?: string | null;
      tags?: string[];
      session_ids?: string[];
      methodology_context?: Parameters<ItemsService['create']>[0]['methodology_context'];
    };
  }>('/api/projects/:id/items', async (req, reply) => {
    if (!requireProject(req.params.id)) return reply.code(404).send({ error: 'project_not_found' });
    const body = req.body ?? {};
    if (typeof body.title !== 'string' || body.title.length === 0) {
      return reply.code(400).send({ error: 'title_required' });
    }
    const input: Parameters<ItemsService['create']>[0] = {
      project_id: req.params.id,
      title: body.title,
    };
    if (body.type !== undefined) input.type = body.type;
    if (body.status !== undefined) input.status = body.status;
    if (body.description !== undefined) input.description = body.description;
    if (body.blocker_text !== undefined && body.blocker_text !== null)
      input.blocker_text = body.blocker_text;
    if (body.parent_id !== undefined) input.parent_id = body.parent_id;
    if (body.branch_ref !== undefined) input.branch_ref = body.branch_ref;
    if (body.tags !== undefined) input.tags = body.tags;
    if (body.session_ids !== undefined) input.session_ids = body.session_ids;
    if (body.methodology_context !== undefined) input.methodology_context = body.methodology_context;
    const item = items.create(input);
    return reply.code(201).send({ item });
  });

  app.patch<{
    Params: { id: string; itemId: string };
    Body: {
      title?: string;
      type?: string;
      status?: string;
      description?: string;
      blocker_text?: string | null;
      parent_id?: string | null;
      branch_ref?: string | null;
      methodology_context?: Parameters<ItemsService['update']>[1]['methodology_context'];
    };
  }>('/api/projects/:id/items/:itemId', async (req, reply) => {
    const existing = items.get(req.params.itemId);
    if (!existing || existing.project_id !== req.params.id) return reply.code(404).send({ error: 'not_found' });
    const body = req.body ?? {};
    const input: Parameters<ItemsService['update']>[1] = {};
    if (body.title !== undefined) input.title = body.title;
    if (body.type !== undefined) input.type = body.type;
    if (body.status !== undefined) input.status = body.status;
    if (body.description !== undefined) input.description = body.description;
    if (body.blocker_text !== undefined) input.blocker_text = body.blocker_text;
    if (body.parent_id !== undefined) input.parent_id = body.parent_id;
    if (body.branch_ref !== undefined) input.branch_ref = body.branch_ref;
    if (body.methodology_context !== undefined) input.methodology_context = body.methodology_context;
    const item = items.update(req.params.itemId, input);
    return { item };
  });

  app.delete<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/items/:itemId',
    async (req, reply) => {
      const existing = items.get(req.params.itemId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      items.delete(req.params.itemId);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string; itemId: string }; Body: { tag?: string } }>(
    '/api/projects/:id/items/:itemId/tags',
    async (req, reply) => {
      const existing = items.get(req.params.itemId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      const tag = req.body?.tag;
      if (typeof tag !== 'string' || tag.length === 0) return reply.code(400).send({ error: 'tag_required' });
      items.addTag(req.params.itemId, tag);
      return { item: items.get(req.params.itemId) };
    },
  );

  app.delete<{ Params: { id: string; itemId: string; tag: string } }>(
    '/api/projects/:id/items/:itemId/tags/:tag',
    async (req, reply) => {
      const existing = items.get(req.params.itemId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      items.removeTag(req.params.itemId, decodeURIComponent(req.params.tag));
      return { item: items.get(req.params.itemId) };
    },
  );

  app.post<{
    Params: { id: string; itemId: string };
    Body: { blocked_by_item_id?: string };
  }>('/api/projects/:id/items/:itemId/blockers', async (req, reply) => {
    const existing = items.get(req.params.itemId);
    if (!existing || existing.project_id !== req.params.id)
      return reply.code(404).send({ error: 'not_found' });
    const blockedBy = req.body?.blocked_by_item_id;
    if (typeof blockedBy !== 'string' || blockedBy.length === 0)
      return reply.code(400).send({ error: 'blocked_by_item_id_required' });
    items.addBlocker(req.params.itemId, blockedBy);
    return { item: items.get(req.params.itemId) };
  });

  app.delete<{ Params: { id: string; itemId: string; blockedById: string } }>(
    '/api/projects/:id/items/:itemId/blockers/:blockedById',
    async (req, reply) => {
      const existing = items.get(req.params.itemId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      items.removeBlocker(req.params.itemId, req.params.blockedById);
      return { item: items.get(req.params.itemId) };
    },
  );

  app.post<{ Params: { id: string; itemId: string; sessionId: string } }>(
    '/api/projects/:id/items/:itemId/sessions/:sessionId',
    async (req, reply) => {
      const existing = items.get(req.params.itemId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      items.addSessionMembership(req.params.itemId, req.params.sessionId);
      return { item: items.get(req.params.itemId) };
    },
  );

  app.delete<{ Params: { id: string; itemId: string; sessionId: string } }>(
    '/api/projects/:id/items/:itemId/sessions/:sessionId',
    async (req, reply) => {
      const existing = items.get(req.params.itemId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      items.removeSessionMembership(req.params.itemId, req.params.sessionId);
      return { item: items.get(req.params.itemId) };
    },
  );
}
