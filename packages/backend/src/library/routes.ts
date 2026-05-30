import type { FastifyInstance } from 'fastify';
import {
  isLibraryEntryType,
  type LibraryEntryType,
  type LibrarySearchRequest,
  type PromptFillRequest,
} from '@throughline/shared';
import { ItemNotFoundError, ProjectNotFoundError } from '@throughline/shared';
import {
  AttachNotANoteError,
  CrossProjectAttachError,
  LibraryEntryNotFoundError,
  LibraryEntryTypeError,
  NotAPromptError,
  type LibraryService,
} from './service.js';
import type { ProjectsService } from '../projects/service.js';

interface CreateBody {
  type?: LibraryEntryType;
  title?: string;
  body?: string;
  tags?: string[];
  summary?: string | null;
}

interface UpdateBody {
  title?: string;
  body?: string;
  tags?: string[];
  summary?: string | null;
}

interface SearchBody {
  query?: string;
  type?: LibraryEntryType;
  scope?: 'project' | 'global';
  limit?: number;
}

interface PromptFillBody {
  values?: Record<string, string>;
}

export function registerLibraryRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: LibraryService,
): void {
  function requireProject(id: string): boolean {
    return projects.get(id) !== null;
  }

  app.get<{ Params: { id: string }; Querystring: { type?: string; scope?: string } }>(
    '/api/projects/:id/library',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const { type, scope } = req.query;
      const filter: { projectId: string | null; type?: LibraryEntryType } = {
        projectId: scope === 'global' ? null : req.params.id,
      };
      if (type !== undefined) {
        if (!isLibraryEntryType(type)) return reply.code(400).send({ error: 'invalid_type' });
        filter.type = type;
      }
      return { entries: service.list(filter) };
    },
  );

  app.get<{ Params: { id: string; entryId: string } }>(
    '/api/projects/:id/library/:entryId',
    async (req, reply) => {
      const entry = service.get(req.params.entryId);
      if (!entry || entry.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      return { entry };
    },
  );

  app.post<{ Params: { id: string }; Body: CreateBody }>(
    '/api/projects/:id/library',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
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
          ...(body.summary !== undefined ? { summary: body.summary } : {}),
        });
        return reply.code(201).send({ entry });
      } catch (err) {
        if (err instanceof LibraryEntryTypeError)
          return reply.code(400).send({ error: 'invalid_type' });
        if (err instanceof ProjectNotFoundError)
          return reply.code(404).send({ error: 'project_not_found' });
        throw err;
      }
    },
  );

  app.patch<{ Params: { id: string; entryId: string }; Body: UpdateBody }>(
    '/api/projects/:id/library/:entryId',
    async (req, reply) => {
      const existing = service.get(req.params.entryId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      const body = req.body ?? {};
      try {
        const entry = service.update(req.params.entryId, body);
        return { entry };
      } catch (err) {
        if (err instanceof LibraryEntryNotFoundError)
          return reply.code(404).send({ error: 'not_found' });
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string; entryId: string } }>(
    '/api/projects/:id/library/:entryId',
    async (req, reply) => {
      const existing = service.get(req.params.entryId);
      if (!existing || existing.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      service.delete(req.params.entryId);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string; entryId: string; itemId: string } }>(
    '/api/projects/:id/library/:entryId/attach/:itemId',
    async (req, reply) => {
      const entry = service.get(req.params.entryId);
      if (!entry || entry.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      try {
        service.attach(req.params.entryId, req.params.itemId);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof AttachNotANoteError)
          return reply.code(422).send({ error: 'not_a_note' });
        if (err instanceof CrossProjectAttachError)
          return reply.code(422).send({ error: 'cross_project_attach' });
        if (err instanceof ItemNotFoundError)
          return reply.code(404).send({ error: 'item_not_found' });
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string; entryId: string; itemId: string } }>(
    '/api/projects/:id/library/:entryId/attach/:itemId',
    async (req, reply) => {
      const entry = service.get(req.params.entryId);
      if (!entry || entry.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      service.detach(req.params.entryId, req.params.itemId);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { id: string; entryId: string } }>(
    '/api/projects/:id/library/:entryId/attached-items',
    async (req, reply) => {
      const entry = service.get(req.params.entryId);
      if (!entry || entry.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      return { items: service.listAttachedItems(req.params.entryId) };
    },
  );

  app.get<{ Params: { id: string; itemId: string } }>(
    '/api/projects/:id/items/:itemId/attached-notes',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return { notes: service.listAttachedNotes(req.params.itemId) };
    },
  );

  app.post<{ Params: { id: string; entryId: string }; Body: PromptFillBody }>(
    '/api/projects/:id/library/:entryId/prompt-fill',
    async (req, reply) => {
      const entry = service.get(req.params.entryId);
      if (!entry || entry.project_id !== req.params.id)
        return reply.code(404).send({ error: 'not_found' });
      const values = (req.body ?? {}).values ?? {};
      try {
        const result = service.fillPrompt(req.params.entryId, {
          values: values as PromptFillRequest['values'],
        });
        return { result };
      } catch (err) {
        if (err instanceof NotAPromptError)
          return reply.code(422).send({ error: 'not_a_prompt' });
        throw err;
      }
    },
  );

  function parseSearch(body: SearchBody): LibrarySearchRequest | { error: string } {
    const query = typeof body.query === 'string' ? body.query : '';
    const scope = body.scope === 'global' ? 'global' : 'project';
    const result: LibrarySearchRequest = { query, scope };
    if (body.type !== undefined) {
      if (!isLibraryEntryType(body.type)) return { error: 'invalid_type' };
      result.type = body.type;
    }
    if (typeof body.limit === 'number') result.limit = body.limit;
    return result;
  }

  app.post<{ Params: { id: string }; Body: SearchBody }>(
    '/api/projects/:id/library/search',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const parsed = parseSearch(req.body ?? {});
      if ('error' in parsed) return reply.code(400).send({ error: parsed.error });
      return { result: service.search(parsed, req.params.id) };
    },
  );

  app.post<{ Params: { id: string }; Body: SearchBody }>(
    '/api/projects/:id/library/semantic-search',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const parsed = parseSearch(req.body ?? {});
      if ('error' in parsed) return reply.code(400).send({ error: parsed.error });
      return { result: service.semanticSearch(parsed, req.params.id) };
    },
  );
}
