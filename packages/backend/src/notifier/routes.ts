import type { FastifyInstance } from 'fastify';
import type { Notifier } from './index.js';
import type { SettingsService } from '../settings/service.js';

// Phase 15 (SPEC §7.25) — OS notification "permission grant", mediated by the backend.
// There is no portable permission API; on macOS/Windows the first fired notification is
// what surfaces the OS-level grant dialog. So the settings panel's grant button just
// fires one through the existing capability layer (T-D32) and records the user's intent
// so feature code (reminder scheduler, etc.) can respect an explicit opt-out later.
export function registerNotifierRoutes(
  app: FastifyInstance,
  notifier: Notifier,
  settings: SettingsService,
): void {
  app.post('/api/notifications/test', async (_req, reply) => {
    try {
      await notifier.notify({
        title: 'Throughline',
        body: 'OS notifications are working. You can disable these in Settings.',
      });
      settings.set('os_notifications_enabled', true);
      return { ok: true as const };
    } catch (err) {
      return reply.code(502).send({
        error: 'notify_failed',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
