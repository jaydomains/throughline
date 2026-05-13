import type { FastifyInstance } from 'fastify';
import type { InboxQueueState, InboxStatusSummary } from '@throughline/shared';
import type { InboxWatcher } from './watcher.js';
import type { InboxWorker } from './worker.js';

interface QueueRow {
  id: string;
  original_path: string;
  received_at: string;
  state: InboxQueueState;
  error_text: string | null;
}

export function registerInboxRoutes(
  app: FastifyInstance,
  worker: InboxWorker,
  watcher: InboxWatcher,
): void {
  app.get<{ Querystring: { limit?: string } }>('/api/inbox/queue', async (req) => {
    const limit = req.query.limit ? Math.max(1, Math.min(500, Number(req.query.limit))) : undefined;
    const rows = worker.listQueue(limit) as QueueRow[];
    const summary: InboxStatusSummary = {
      queued: rows.filter((r) => r.state === 'queued').length,
      processed_recent: rows.filter((r) => r.state === 'processed').length,
      failed_recent: rows.filter((r) => r.state === 'failed').length,
    };
    return {
      summary,
      entries: rows.map((r) => ({
        id: r.id,
        original_path: r.original_path,
        received_at: r.received_at,
        state: r.state,
        error_text: r.error_text,
      })),
    };
  });

  app.post('/api/inbox/scan', async () => {
    await watcher.scanOnce();
    return { ok: true };
  });
}
