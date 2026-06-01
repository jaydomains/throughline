import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { registerErrorHandler } from '../src/http/error-handler.js';
import { ItemPolicyError } from '../src/items/service.js';

// E18 / S6-02 (verified-closed) — the reconcile/route-layer ItemPolicyError fragility is
// closed by the central C-D23 error handler: an ItemPolicyError is a DomainError(400), and a
// thrown DomainError is mapped to its canonical status + code uniformly, so reconcile-apply
// (and every route) no longer needs a hand-rolled try/catch to avoid an unhandled 500.
describe('E18 / S6-02 — central error handler maps DomainError to its status (C-D23)', () => {
  it('a thrown ItemPolicyError surfaces as 400 policy_violation, not an unhandled 500', async () => {
    const app = Fastify();
    registerErrorHandler(app);
    app.get('/boom', async () => {
      throw new ItemPolicyError('status "x" not allowed', 'status');
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'policy_violation' });
    await app.close();
  });

  it('a generic 5xx error is logged but never leaks its message to the client', async () => {
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    app.get('/oops', async () => {
      throw new Error('connection failed at /secret/db/path');
    });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/oops' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'internal_error', message: 'An internal error occurred' });
    expect(JSON.stringify(res.json())).not.toContain('/secret/db/path');
    await app.close();
  });
});
