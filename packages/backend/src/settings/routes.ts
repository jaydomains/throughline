import type { FastifyInstance } from 'fastify';
import type { SettingsService } from './service.js';

export function registerSettingsRoutes(app: FastifyInstance, settings: SettingsService): void {
  app.get('/api/settings', async () => {
    return { settings: settings.getAll() };
  });

  app.put<{ Body: Record<string, unknown> }>('/api/settings', async (req, reply) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return reply.code(400).send({ error: 'object_body_required' });
    }
    try {
      settings.setMany(req.body);
      return { settings: settings.getAll() };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      return reply.code(400).send({ error: 'invalid_setting', message });
    }
  });
}
