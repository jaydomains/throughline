import { createReadStream } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { BackupService } from './service.js';

export function registerBackupRoutes(app: FastifyInstance, backup: BackupService): void {
  app.get('/api/backup/status', async () => backup.status());

  app.post('/api/backup/export', async (_req, reply) => {
    const snap = await backup.createSnapshot();
    let stream;
    try {
      stream = createReadStream(snap.path);
    } catch (err) {
      // Stream construction failed — the temp snapshot would otherwise orphan.
      snap.cleanup();
      throw err;
    }
    // Clean the temp snapshot once the response is fully flushed (or the client aborts).
    stream.on('close', snap.cleanup);
    stream.on('error', snap.cleanup);
    return reply
      .type('application/octet-stream')
      .header('content-disposition', `attachment; filename="${snap.filename}"`)
      .send(stream);
  });
}
