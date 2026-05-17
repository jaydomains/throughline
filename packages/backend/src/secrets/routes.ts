import type { FastifyInstance } from 'fastify';
import type { SecretsPresenceResult, SecretsWriteInput } from '@throughline/shared';
import { secretsPresence, writeSecrets } from './store.js';

// T-D4 — the browser may set API keys but never read them back. Both endpoints return
// presence booleans only; the key values never cross the backend↔browser boundary.
export function registerSecretsRoutes(app: FastifyInstance, secretsPath: string): void {
  app.get('/api/secrets', async (): Promise<SecretsPresenceResult> => {
    return secretsPresence(secretsPath);
  });

  app.put<{ Body: SecretsWriteInput }>('/api/secrets', async (req, reply) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply.code(400).send({ error: 'object_body_required' });
    }
    const patch: SecretsWriteInput = {};
    if (typeof body.anthropic_api_key === 'string') patch.anthropic_api_key = body.anthropic_api_key;
    if (typeof body.github_pat === 'string') patch.github_pat = body.github_pat;
    writeSecrets(secretsPath, patch);
    return secretsPresence(secretsPath) satisfies SecretsPresenceResult;
  });
}
