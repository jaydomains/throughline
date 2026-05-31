import type { FastifyInstance } from 'fastify';
import type { NotificationTestResult } from '@throughline/shared';
import type { Notifier } from './index.js';
import type { SettingsService } from '../settings/service.js';

// Phase 15 (SPEC §7.25) — OS notification "permission grant", mediated by the backend.
// There is no portable permission API; on macOS/Windows the first fired notification is
// what surfaces the OS-level grant dialog. So the settings panel's grant button just
// fires one through the existing capability layer (T-D32) and records the user's intent
// so feature code (reminder scheduler, etc.) can respect an explicit opt-out later.
//
// E4 / T-D60: the endpoint reports the real delivery outcome. `os_notifications_enabled`
// is set ONLY on an actual 'delivered' — an 'unavailable' (no OS backend) or 'failed'
// fire no longer claims success or flips the setting on (SF5-03).
export function registerNotifierRoutes(
  app: FastifyInstance,
  notifier: Notifier,
  settings: SettingsService,
): void {
  app.post('/api/notifications/test', async (): Promise<NotificationTestResult> => {
    const result = await notifier.notify({
      title: 'Throughline',
      body: 'OS notifications are working. You can disable these in Settings.',
    });
    if (result.outcome === 'delivered') {
      settings.set('os_notifications_enabled', true);
      return { outcome: 'delivered' };
    }
    if (result.outcome === 'unavailable') {
      return {
        outcome: 'unavailable',
        message:
          'No OS notification backend is available on this system. Install node-notifier to enable native delivery.',
      };
    }
    return {
      outcome: 'failed',
      message: result.error ?? 'Notification delivery failed.',
    };
  });
}
