import type { FastifyInstance } from 'fastify';
import type { SettingsService } from './service.js';

// Settings keys that should appear with a default value in /api/settings responses even
// before the user has written to them. Phase 3 surfaces stale_threshold_days for the item
// stale-flag (T-D46); CHECKLIST §15 will wire a settings UI control later. 14 is a
// placeholder default — SPEC §7.25 says "configurable" but doesn't pick a number; the choice
// is recorded in the Phase 3 handover.
export const SETTINGS_DEFAULTS: Record<string, unknown> = {
  stale_threshold_days: 14,
};

function withDefaults(values: Record<string, unknown>): Record<string, unknown> {
  return { ...SETTINGS_DEFAULTS, ...values };
}

export function registerSettingsRoutes(app: FastifyInstance, settings: SettingsService): void {
  app.get('/api/settings', async () => {
    return { settings: withDefaults(settings.getAll()) };
  });

  app.put<{ Body: Record<string, unknown> }>('/api/settings', async (req, reply) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return reply.code(400).send({ error: 'object_body_required' });
    }
    try {
      settings.setMany(req.body);
      return { settings: withDefaults(settings.getAll()) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      return reply.code(400).send({ error: 'invalid_setting', message });
    }
  });
}
