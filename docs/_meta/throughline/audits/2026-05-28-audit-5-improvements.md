<!-- Historical artifact. Audit 5 of 5, conducted 2026-05-28 against the repo state of that date. Committed retroactively 2026-05-30 (see handover 2026-05-30-audit-backfill-five-audit-reports.md). Transcribed verbatim from the original session deliverable — NOT edited, summarized, or updated. Findings later closed by subsequent phases are still listed here as originally found; closure is recorded in PLATFORM_STATUS / handovers, not here. The cross-audit synthesis delivered at session close lives in the companion file 2026-05-28-audit-synthesis.md. -->

# Throughline — Improvements Audit (Audit 5 of 5)

**Date:** 2026-05-28 · Read-only; no fixes. Every finding carries a concrete change + concrete benefit + **effort tag**.
**Overall:** the codebase is genuinely disciplined (batched loads, validate-then-transact, capability-gated AI, strong a11y baseline, zero `as any`, strict tsconfig). Findings cluster into a few high-leverage themes rather than scattered nits.

## Headline findings (High severity, by payoff)

| ID | Finding | Effort | Payoff |
|---|---|---|---|
| **I5-01** | 16 byte-identical `ProjectNotFoundError` (+4 `ItemNotFoundError`) copies → one shared type. `intelligence/routes.ts` currently imports the *same class* under **6 aliases** + a 6-arm `instanceof` chain. | medium | ~100 lines; precondition for I5-02 |
| **I5-02** | 17 routes' hand-rolled `try/catch`→HTTP mapping → one Fastify `setErrorHandler` + `mapDomainError`. | medium | ~150–200 lines; **fixes audit-4's same-error/different-status bugs** (items→400 vs sessions→404 for `ProjectNotFoundError`) |
| **I3-01** | 8 data hooks share two verbatim skeletons → `useResource`/`usePolledResource`. | medium | ~100 lines; **unifies the unmount-guard that's missing in exactly the audit-4 swallow hooks** (useItems/useSessions) |
| **I1 (seg1)** | `citedAnchors`/`stateDigest`/AI-telemetry duplicated across the 3 methodology engines → `methodology/project-digest.ts`. | medium | ~80 lines; one home for the anchor SQL |
| **I4-B01** | No code-splitting — entire app is one 383 KB chunk. Route-split the 5 heavy views via `React.lazy`. | medium | ~45–55 kB gzip off initial load; biggest TTI win |
| **I6-01** | `safe-regex` test only covers *grouped* ReDoS; **adjacent-ungrouped (`a*a*a*…`) confirmed LIVE — 106 s on a 20-quantifier input.** Add the failing case. | trivial | catches S2-01; exposes that the guard itself needs the rule |
| **I6-02 / I6-03** | No test for scanner-throw-dismisses-signals (SF2-01) or dump-zone non-atomic re-apply duplication (S5-01). | small | locks the two nastiest silent/data bugs |
| **I4-A01 / A02 / A05** | LibraryView rows mouse-only; TreeView rows focusable-but-dead (no Enter/Space); no modal focus-trap/restore. | small/trivial/medium | keyboard users can't select library/tree entries today |

## By theme (the four aggregator patterns)

**1. Repeated abstractions not extracted (~540 lines total).** Seg 5's five cross-domain extractions (I5-01 errors, I5-02 error-handler, I5-03 `resolveProjectBundle`, I5-04 `recordAiCost`, I5-05 AI/heuristic router; ~390–450 lines) + within-methodology engine dup (seg1 I4) + frontend hook/modal/draft-field dup (I3-01/02/06; ~150 lines). Seg 1 and Seg 2 independently surfaced the AI-telemetry block that Seg 5 owns as I5-04 — three segments converging on it confirms the scale (~11–14 call sites). Seg 5's "investigated but rejected" list (service factories, `appendAudit`, capability-probes) is appropriately disciplined.

**2. Test gaps paired to known defects (the sharpest output).** Seg 6's paired table: of the 8 audit-2/3/4 problem sites, **T-D54 and T-D57 are genuinely well-tested** (real invariant assertions, not happy-path), but **7 lack a catching test** — S2-01 (confirmed live), SF2-01, S5-01, S4-01, F1-01, SF6-01/02, S7-01. Each has a named, scoped regression test. Plus **mock-drift risk**: `github.test.ts` hand-rolls `ReconcileService`/`GitHubApi` stubs via `as unknown as` that the untyped backend `test/**` won't catch when the real shape changes — the exact cohort-hardener failure mode. Missing integration tests: bootstrap render→watch→ingest→archive, reconcile auto-merge→apply→undo, clone-and-go init.

**3. Compounding performance.** N+1 family: I2-01 (`tiers.ts` per-rule query, runs every 60 s poll), I2-03 (md-ingest scan, up to 500 per-file queries → 1) — both "one query before the loop + Map" fixes. Frontend: I3-05 (detail-panel does 6 serial awaits → `Promise.all`, 6 RTT→1 on every item-open and arrow-cycle); seg1 I1 (per-anchor regex recompile, N×M→M; the sibling scanner already hoists it). Cleanup: I3-03's shared-`busy` flag locks out all 6 IntelligenceView panels on any one action.

**4. Type safety & green-gate true coverage (the distinct meta-finding).** Unit-level type safety is strong. But Seg 7 Deliverable B shows the green gate has two blind spots: **(Gap 1)** backend `test/**` — **53 files / 12,826 LOC** — is excluded from `tsc`, so mock-vs-real drift ships green (ties to Seg 6's mock-drift note and audit-1 I1); **(Gap 2)** `jsonFetch<T>(...) as T` is an unvalidated wire cast and `MethodologySummary` is frontend-local, so "typecheck passes" ≠ "front and back agree." Closes via: typecheck the backend test tree, and move response types to `@throughline/shared` + a wire-contract test. Plus I7-02 (the closed-set `Settings` should be a typed schema, not `Record<string,unknown>`).

## Bundle/build & accessibility (Seg 4, honest static/runtime split)
- **Bundle:** I4-B01 (route-split, High) → I4-B02 (~456 KB of redundant `woff` fonts never loaded — woff2 wins; drop them) → I4-B04 (vendor `manualChunks`), I4-B05 (lazy `fuse.js`), I4-B03 (unused Geist 300/700 weights), I4-B06 (1.48 MB prod sourcemap — confirm intent).
- **A11y STATIC-confirmed:** I4-A01..A08 (keyboard activation on rows, `aria-modal`, focus-ring, skip-link, graph-edge labels).
- **A11y NEEDS-RUNTIME (cannot confirm statically — flagged as such):** I4-R01..R07 — modal focus containment, command-palette combobox announcements, graph keyboard flow, theme contrast, reduced-motion, SSE live-region announcements. A future runtime a11y pass should use this checklist; static analysis honestly can't cover it.

## Lower-severity (compact — full detail in segment reports)
Backend: seg1 I2 (H3-walker dup), I3 (CSV-split helper), I6/I7 (bootstrap upsert/validator dup), I8 (magic number), I9 (scan logging); seg2 I2-02 (inbox file-move dup), I2-04..07. Frontend: I3-04 (DirectiveList), I3-07/08 (binding-array, inline styles). Types: I7-03/04/05 (DB-read/wire casts, `!` clusters — noted as clusters, not per-instance).

---

### Per-segment notes (captured during the audit)

- **Seg 1 methodology + bootstrap:** 9 findings (2 High: I4 engine `citedAnchors`/`stateDigest` dup, I5 AI-telemetry dup [superseded by cross-domain I5-04]; 4 Medium; 3 Low). Sharpest: the three-way engine duplication, bootstrap three-entity upsert/validator repetition, bundle-parser H3-walker + CSV-split idioms, and the per-anchor regex recompile perf (I1).
- **Seg 2 other backend domains:** "unusually disciplined." 7 findings — I2-01 (Medium, steady-state N+1 in tier-1 path), I2-02 (Medium, inbox file-move dup), 5 Low perf/readability. Strong Seg-5 pointers handed off (AI-telemetry tail, dump-zone/reconcile shared helpers, fs-walk idiom).
- **Seg 3 frontend logic:** 8 findings — I3-01 (High, `useResource`/`usePolledResource`), I3-02 (modal shell), I3-03 (IntelligenceView split + shared-busy lockout), I3-04 (DirectiveList), I3-05 (parallel detail-panel refresh), I3-06..08 (Low).
- **Seg 4 a11y + bundle:** STATIC a11y I4-A01..A08; NEEDS-RUNTIME checklist I4-R01..R07; bundle I4-B01..B06.
- **Seg 5 cross-subsystem dup:** I5-01..05, ~390–450 lines removable. Disciplined "investigated but rejected" list.
- **Seg 6 test coverage:** paired gap table vs audits 2-4; 8 findings (3 High, 4 Medium, 1 Low); S2-01 ReDoS confirmed live (106 s); strongest gaps SF2-01/S5-01/SF6; T-D54 + T-D57 tests genuinely strong; mock-drift risk in `github.test.ts` stubs.
- **Seg 7 type safety:** I7-01..05 (zero `as any`; strict config); Deliverable B green-gate meta-finding (Gap 1 backend tests untyped 12,826 LOC; Gap 2 unvalidated wire cast).
