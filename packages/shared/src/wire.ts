// Wire-contract response envelopes (T-D59).
//
// These response shapes live in @throughline/shared so the frontend api client and the
// backend route handlers reference one type per endpoint instead of each side declaring
// its own. The backend route handlers annotate their return type with these (so `tsc`
// fails if a handler stops producing the declared shape), the frontend `jsonFetch`
// targets them, and `packages/backend/test/wire-contract.test.ts` asserts the running
// backend actually emits these shapes. Together that closes audit-1 I1 Gap 2: the wire
// contract is verified at compile time (both sides) and at runtime (the contract test),
// rather than trusting an unvalidated `as T` cast at the fetch boundary.
//
// Inner entity types (Item, Session, ItemPolicy, BundleIdentity, …) already live in
// their own shared modules; this module only owns the response *envelopes* and the
// projection types that were previously frontend-local.

import type { BundleIdentity, BundleStructuralError } from './bundle.js';
import type { Item, ItemPolicy } from './items.js';
import type { Session } from './sessions.js';

/**
 * Per-bundle summary returned by `GET /api/methodologies` — a projection of the
 * backend's `BundleLoadResult`. Previously declared frontend-local in `api.ts`; moved
 * here so both sides share one definition (the Gap-2 named type).
 */
export interface MethodologySummary {
  status: 'loaded' | 'error';
  bundle_id: string;
  identity?: BundleIdentity;
  errors?: BundleStructuralError[];
  has_primary_unit?: boolean;
  has_gates?: boolean;
}

/** `GET /api/methodologies` */
export interface MethodologiesResponse {
  methodologies: MethodologySummary[];
}

/** `GET /api/projects/:id/items` */
export interface ItemsResponse {
  items: Item[];
}

/** Single-item responses (`GET /api/projects/:id/items/:itemId`, mutations). */
export interface ItemResponse {
  item: Item;
}

/** `GET /api/projects/:id/policy` */
export interface PolicyResponse {
  policy: ItemPolicy;
}

/** `GET /api/projects/:id/sessions` */
export interface SessionsResponse {
  sessions: Session[];
}

/** Single-session responses (`GET .../sessions/:sessionId`, `POST .../sessions`). */
export interface SessionResponse {
  session: Session;
}
