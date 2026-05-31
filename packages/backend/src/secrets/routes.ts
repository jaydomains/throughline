import type { FastifyInstance } from 'fastify';
import type { SecretsPresenceResult, SecretsWriteInput } from '@throughline/shared';
import { appendAudit } from '../audit/log.js';
import type { DB } from '../db/index.js';
import { secretsPresence, writeSecrets } from './store.js';

// T-D4 — the browser may set API keys but never read them back. Both endpoints return
// presence booleans only; the key values never cross the backend↔browser boundary.
export function registerSecretsRoutes(app: FastifyInstance, secretsPath: string, db: DB): void {
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
    // SF7-01: credential set/clear/rotate must leave an audit trail. EVENT-ONLY (T-D24) —
    // the row records *which* key changed and whether it was set or cleared, NEVER the
    // value (which never enters the datastore, T-D4). One row per key actually touched.
    for (const key of ['anthropic_api_key', 'github_pat'] as const) {
      const v = patch[key];
      if (v === undefined) continue;
      appendAudit(db, {
        projectId: null,
        entityType: 'settings',
        entityId: 'secrets',
        actor: 'user',
        field: `credential:${key}`,
        newValue: v === '' ? 'cleared' : 'set',
      });
    }
    return secretsPresence(secretsPath) satisfies SecretsPresenceResult;
  });
}
