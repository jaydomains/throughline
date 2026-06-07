import type { FastifyError, FastifyInstance } from 'fastify';
import { DomainError, type ErrorResponse } from '@throughline/shared';

// C-D23 — central Fastify error handler. Domain errors (T-D58) carry their canonical
// statusCode + code + optional details on the class; this reads them and emits the uniform
// ErrorResponse body, so routes no longer hand-roll status mapping in per-handler
// try/catch. The implementation spans Phase B slice 1 (the @throughline/shared hierarchy)
// and slice 3 (this handler + the ErrorResponse body shape).
//
// Only *thrown* errors reach here. Routes that validate inline with `reply.code(...).send`
// bypass the handler entirely (no Fastify schema validation is in use), so those direct
// replies are unaffected. Non-domain thrown errors keep Fastify's semantics: an explicit
// 4xx statusCode is preserved; anything else is a logged 500.
export function registerErrorHandler(app: FastifyInstance): void {
  // Fastify v5 changed setErrorHandler's default error type from FastifyError to unknown;
  // pin it back to FastifyError (extends Error; carries the optional statusCode this reads).
  app.setErrorHandler<FastifyError>((err, req, reply) => {
    if (err instanceof DomainError) {
      const body: ErrorResponse = { error: err.code, message: err.message, ...(err.details ?? {}) };
      return reply.code(err.statusCode).send(body);
    }
    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
    if (statusCode >= 500) req.log.error(err);
    // Never leak a raw 5xx message to the client — generic Errors can carry internal
    // detail (DB schema, file paths, upstream API bodies). The full error is logged
    // server-side above. 4xx messages are user-actionable and authored, so kept.
    const body: ErrorResponse = {
      error: statusCode >= 500 ? 'internal_error' : 'bad_request',
      message: statusCode >= 500 ? 'An internal error occurred' : err.message,
    };
    return reply.code(statusCode).send(body);
  });
}
