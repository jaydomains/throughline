import type { FastifyInstance } from 'fastify';
import {
  type MdIngestService,
} from './service.js';
import type { MdIngestWatcher } from './watcher.js';
import type { ProjectsService } from '../projects/service.js';

interface AddFolderBody {
  path?: string;
}

interface ScanBody {
  folder_id?: string;
}

interface IngestBody {
  folder_id?: string;
  paths?: string[];
}

interface TrackBody {
  tracked?: boolean;
}

export function registerMdIngestRoutes(
  app: FastifyInstance,
  projects: ProjectsService,
  service: MdIngestService,
  watcher: MdIngestWatcher,
): void {
  function requireProject(id: string): boolean {
    return projects.get(id) !== null;
  }

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/md-ingest/folders',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      return { folders: service.listFolders(req.params.id) };
    },
  );

  app.post<{ Params: { id: string }; Body: AddFolderBody }>(
    '/api/projects/:id/md-ingest/folders',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const path = req.body?.path;
      if (typeof path !== 'string' || path.trim().length === 0) {
        return reply.code(400).send({ error: 'path_required' });
      }
      const folder = service.addFolder(req.params.id, path);
      watcher.refresh();
      return { folder };
    },
  );

  app.delete<{ Params: { id: string; folderId: string } }>(
    '/api/projects/:id/md-ingest/folders/:folderId',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      service.removeFolder(req.params.id, req.params.folderId);
      watcher.refresh();
      return { ok: true as const };
    },
  );

  app.post<{ Params: { id: string }; Body: ScanBody }>(
    '/api/projects/:id/md-ingest/scan',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const folderId = req.body?.folder_id;
      if (typeof folderId !== 'string' || folderId.length === 0) {
        return reply.code(400).send({ error: 'folder_id_required' });
      }
      return { result: service.scan(req.params.id, folderId) };
    },
  );

  app.post<{ Params: { id: string }; Body: IngestBody }>(
    '/api/projects/:id/md-ingest/ingest',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const folderId = req.body?.folder_id;
      const paths = req.body?.paths;
      if (typeof folderId !== 'string' || folderId.length === 0) {
        return reply.code(400).send({ error: 'folder_id_required' });
      }
      if (!Array.isArray(paths)) {
        return reply.code(400).send({ error: 'paths_required' });
      }
      const result = await service.ingest(req.params.id, {
        folder_id: folderId,
        paths: paths.filter((p): p is string => typeof p === 'string'),
      });
      return { result };
    },
  );

  app.patch<{ Params: { id: string; entryId: string }; Body: TrackBody }>(
    '/api/projects/:id/md-ingest/entries/:entryId/track',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      if (typeof req.body?.tracked !== 'boolean') {
        return reply.code(400).send({ error: 'tracked_required' });
      }
      return {
        entry: service.setTracked(req.params.id, req.params.entryId, req.body.tracked),
      };
    },
  );

  app.post<{ Params: { id: string; entryId: string } }>(
    '/api/projects/:id/md-ingest/entries/:entryId/reingest',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      const { entry, changed } = await service.reingestEntry(
        req.params.id,
        req.params.entryId,
        'user',
      );
      return { entry, changed };
    },
  );
}
