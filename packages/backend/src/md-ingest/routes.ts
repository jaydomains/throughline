import type { FastifyInstance } from 'fastify';
import {
  EntryNotFoundError,
  FolderMissingError,
  FolderNotFoundError,
  FolderOutsideRepoError,
  NotAnImportedDocError,
  ProjectNotFoundError,
  SourceFileMissingError,
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
      try {
        const folder = service.addFolder(req.params.id, path);
        watcher.refresh();
        return { folder };
      } catch (err) {
        if (err instanceof FolderOutsideRepoError) {
          return reply.code(400).send({ error: 'folder_outside_repo' });
        }
        if (err instanceof FolderMissingError) {
          return reply.code(400).send({ error: 'folder_missing' });
        }
        if (err instanceof ProjectNotFoundError) {
          return reply.code(404).send({ error: 'project_not_found' });
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string; folderId: string } }>(
    '/api/projects/:id/md-ingest/folders/:folderId',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      try {
        service.removeFolder(req.params.id, req.params.folderId);
        watcher.refresh();
        return { ok: true as const };
      } catch (err) {
        if (err instanceof FolderNotFoundError) {
          return reply.code(404).send({ error: 'folder_not_found' });
        }
        throw err;
      }
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
      try {
        return { result: service.scan(req.params.id, folderId) };
      } catch (err) {
        if (err instanceof FolderNotFoundError) {
          return reply.code(404).send({ error: 'folder_not_found' });
        }
        if (err instanceof FolderMissingError) {
          return reply.code(400).send({ error: 'folder_missing' });
        }
        if (err instanceof FolderOutsideRepoError) {
          return reply.code(400).send({ error: 'folder_outside_repo' });
        }
        throw err;
      }
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
      try {
        const result = await service.ingest(req.params.id, {
          folder_id: folderId,
          paths: paths.filter((p): p is string => typeof p === 'string'),
        });
        return { result };
      } catch (err) {
        if (err instanceof FolderNotFoundError) {
          return reply.code(404).send({ error: 'folder_not_found' });
        }
        throw err;
      }
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
      try {
        return {
          entry: service.setTracked(req.params.id, req.params.entryId, req.body.tracked),
        };
      } catch (err) {
        if (err instanceof EntryNotFoundError) {
          return reply.code(404).send({ error: 'entry_not_found' });
        }
        if (err instanceof NotAnImportedDocError) {
          return reply.code(400).send({ error: 'not_an_imported_doc' });
        }
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string; entryId: string } }>(
    '/api/projects/:id/md-ingest/entries/:entryId/reingest',
    async (req, reply) => {
      if (!requireProject(req.params.id)) {
        return reply.code(404).send({ error: 'project_not_found' });
      }
      try {
        const { entry, changed } = await service.reingestEntry(
          req.params.id,
          req.params.entryId,
          'user',
        );
        return { entry, changed };
      } catch (err) {
        if (err instanceof EntryNotFoundError) {
          return reply.code(404).send({ error: 'entry_not_found' });
        }
        if (err instanceof NotAnImportedDocError) {
          return reply.code(400).send({ error: 'not_an_imported_doc' });
        }
        if (err instanceof SourceFileMissingError) {
          return reply.code(409).send({ error: 'source_file_missing' });
        }
        throw err;
      }
    },
  );
}
