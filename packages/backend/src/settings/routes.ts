import type { FastifyInstance } from 'fastify';
import type { SettingsService } from './service.js';

// Settings keys that should appear with a default value in /api/settings responses even
// before the user has written to them. Phase 3 surfaces stale_threshold_days for the item
// stale-flag (T-D46). Phase 15 adds the backup / periodic-review / cost-meter knobs so the
// settings panel renders sensible defaults before first write. Defaults follow the spec
// where it picks a number (backup_threshold_days=7, CODE_SPEC §17), the §13/Q#9 sanctioned
// build choice where the spec defers (cost_daily_threshold_usd=null = no threshold;
// auto_copy_target_path=null = local-only), and the Phase 3/14 handover choices otherwise
// (stale_threshold_days=14, periodic_review_interval_days=14).
export const SETTINGS_DEFAULTS: Record<string, unknown> = {
  stale_threshold_days: 14,
  backup_threshold_days: 7,
  backup_nudge_interval_days: 7,
  auto_copy_target_path: null,
  archive_retention_days: 30,
  periodic_review_interval_days: 14,
  cost_daily_threshold_usd: null,
  default_model: 'sonnet',
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
