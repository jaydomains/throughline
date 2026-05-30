// Shared domain-error hierarchy (T-D58). Domain errors carry their canonical HTTP
// status on the class itself: a `statusCode` and a stable string `code`, plus optional
// structured `details`. The central Fastify error handler (C-D23, Phase B slice 3) reads
// these off the thrown error and maps them uniformly — the route never re-decides the
// status, which is what makes the prior 404-vs-400 drift (audit SF6-09) structurally
// impossible to reintroduce.
//
// Until slice 3 installs the central handler, routes still catch these errors; the
// statusCode/code fields are inert-but-correct in the interim. One canonical definition
// per error replaces the per-module copies (16+ ProjectNotFoundError, etc.), so a single
// `instanceof` works across every consumer (collapsing the former aliased-import chains).

export interface DomainErrorOptions {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Canonical error-response body shape emitted by the central handler (C-D23): a stable
 * `error` code, an optional human `message`, and any structured `details` fields spread
 * in. Shared so frontend and backend reference one contract (partial progress on the
 * wire-contract gap the green-gate reckoning names; full closure is Phase D).
 */
export interface ErrorResponse {
  error: string;
  message?: string;
  [key: string]: unknown;
}

/** Base for every error that maps to a deliberate HTTP response. Never thrown directly. */
export abstract class DomainError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, options: DomainErrorOptions) {
    super(message);
    // Concrete subclass name (e.g. "ProjectNotFoundError") for logs/serialization.
    this.name = new.target.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    if (options.details !== undefined) this.details = options.details;
  }
}

/** 404 family. Subclasses supply only their canonical `code` (and optional details). */
export abstract class NotFoundError extends DomainError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, details === undefined ? { statusCode: 404, code } : { statusCode: 404, code, details });
  }
}

export class ProjectNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`project ${id} not found`, 'project_not_found');
  }
}

export class ItemNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`item ${id} not found`, 'item_not_found');
  }
}

export class SessionNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`session ${id} not found`, 'session_not_found');
  }
}
