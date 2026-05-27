# Throughline Handover — Phase 20 Slice 2: derivation module (`bootstrapId` + per-source-type resolvers + `@bootstrap-id:` override)

**Generated:** 2026-05-27
**Last commit SHA:** pending — 2026-05-27
**Previous handover:** `2026-05-27-phase-20-slice-1-schema-migration.md` (Slice 1 — PR #53, merged 2026-05-27, 0 fix-rounds)

Second slice of the Phase 20 bootstrap-ingest chain (tracking issue [#52](https://github.com/jaydomains/throughline/issues/52), `Auto-continue: phase-20-bootstrap-ingest`).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| C-D20 surface 3 — `packages/backend/src/bootstrap/derive-id.ts` exports `bootstrapId(sourceType, key)` returning `<source-type>:<stable-key>` for all five T-D54 source types | built | `packages/backend/src/bootstrap/derive-id.ts` (`bootstrapId()` switch on `SourceType`); `packages/backend/test/bootstrap-derive-id.test.ts` (per-source-type tests) | Exhaustive switch (`exhaustive: never`) guards against future source-type additions landing without an explicit resolver. Empty-key guard rejects misuse. |
| T-D54 — content-hashed types (currently `checklist`) reuse sha256/16-char hex, unsalted | built | `derive-id.ts` private `sha256_16()` helper; "checklist: raw text is normalised then sha256/16-char-hex prefixed" test | Adjacent to `packages/backend/src/ai/fingerprint.ts` so the three hash conventions (`promptFingerprint` salted, `contentHash` unsalted, `bootstrapId` unsalted) read as siblings. |
| T-D54 — `checklist` normalisation: lowercase, whitespace collapsed, trailing punctuation stripped | built | `derive-id.ts` `normalizeChecklistText()` exported function; six `normalizeChecklistText()` tests + "absorbs casing/whitespace/punctuation" and "word-level edits break identity" tests in `bootstrapId` block | Exported (not internal) so Slice 3's validator can use the same canonicalisation for duplicate-detection if needed, and so the test suite can assert the rule in isolation from the hash. |
| T-D54 — universal `<!-- @bootstrap-id: my-slug -->` override extracted from row markdown | built | `derive-id.ts` `extractBootstrapIdOverride()` exported function; 7 override-extraction tests | First-marker-wins semantics; trim-after-extract; returns null on absent / whitespace-only payload / non-marker comments. Duplicate-marker detection is a validator concern (Slice 3). |
| Chain progression: Slice 1 ticked in `CHECKLIST.md`; `PLATFORM_STATUS.md` Snapshot + Current Phase rolled; `.claude-code/auto-continue-state.json` records Slice 1 merged + Slice 2 open | built | `CHECKLIST.md` §20 Slice 1 box ticked with PR #53 evidence; `PLATFORM_STATUS.md` Snapshot + Current Phase; `.claude-code/auto-continue-state.json` (`slices[0].status: "merged"`, `slices[1].status: "open"`, `currentIndex: 1`) | Standard per-slice post-work refresh per `AUTHORING_DISCIPLINE.md` §"Per-slice light hardener". |

---

## Last Decision Minted

No new decisions minted. Implementation followed T-D54 (per-source-type derivation rules; universal override syntax) and C-D20 surface 3 (module location + `bootstrapId(sourceType, key)` signature + hash convention). Implementation-shape choices recorded inline at the module site:

- **Content-hashed type lives behind the same single-entrypoint signature as pass-through types.** `bootstrapId('checklist', raw_text)` accepts raw text and normalises + hashes internally; callers do not pre-normalise. Keeps the normalisation rule in one location and prevents the validator (Slice 3) from drifting against the producer (Phase 21).
- **`normalizeChecklistText` and `extractBootstrapIdOverride` are exported, not module-internal.** Slice 3's validator may need to assert canonical form when surfacing duplicate-collision errors; tests need to assert the normalisation rule in isolation from the hash; Phase 21's prompt template documentation may want to reference the same canonicalisation by code. The cost of exporting is zero; the cost of duplicating either rule downstream is high.
- **Override extraction returns string | null, not throwing on malformed input.** A row with a malformed comment is not a parser error at the derivation layer — it is "no override present, fall back to natural-key derivation". The validator (Slice 3) is the right place to surface a duplicate-marker error if it encounters one; the derivation layer is a primitive.
- **Exhaustive `switch (sourceType)` with `const exhaustive: never = sourceType`.** Future source-type additions land as compile-time errors that name the missing resolver, not silent runtime fall-throughs.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `packages/backend/src/bootstrap/derive-id.ts` — `bootstrapId(sourceType, key)` + `normalizeChecklistText(input)` + `extractBootstrapIdOverride(markdown)` + `SourceType` discriminated union + `SOURCE_TYPES` ordered const tuple. ~85 lines.
- `packages/backend/test/bootstrap-derive-id.test.ts` — 25 tests across four describe blocks (`bootstrapId() — per-source-type derivation`, `normalizeChecklistText()`, `extractBootstrapIdOverride()`, `SOURCE_TYPES export`). ~150 lines.
- `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-2-derive-id-module.md` — this handover.

**Modified:**
- `.claude-code/auto-continue-state.json` — Slice 1 marked merged (PR #53, 0 fix-rounds, mergedAt 2026-05-27T19:29Z); Slice 2 marked open; `currentIndex: 1`.
- `CHECKLIST.md` §20 — Slice 1 box ticked with PR #53 evidence and handover path.
- `docs/_meta/throughline/PLATFORM_STATUS.md` — Snapshot updated for Slice 1 merged + Slice 2 in flight; Current Phase rolled.

**Deleted:** _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Initial typecheck failure: `match[1]` accessed without optional-chain guard | `packages/backend/src/bootstrap/derive-id.ts` `extractBootstrapIdOverride` | First draft accessed `match[1].trim()` directly; under `noUncheckedIndexedAccess` (or equivalent strict-tuple semantics in the repo's tsconfig) `match[1]` is `string \| undefined` even when the regex implies the capture group is mandatory. | Folded inline before commit: replaced with `match?.[1]` capture into a local `captured`, with explicit null-return on missing. No runtime behaviour change; same test coverage applies. Captured here so the next slice's first author knows to expect strict tuple-access typing on regex captures. |

---

## Open Questions

- [ ] **Override-marker duplicate detection in a single row.** Slice 2 returns the first matching marker; the validator in Slice 3 is responsible for raising a clear error when a single row carries two `@bootstrap-id:` markers. Landing site: Slice 3 validator.
- [ ] **Duplicate `bootstrap_id` detection across rows in one import file.** Per T-D54 ("Two rows resolving to the same `bootstrap_id` in a single import file are rejected up-front with an error citing both source rows"). Landing site: Slice 3 validator. The derivation layer exposes the primitives; the validator collects + de-dupes.

---

## Recently Resolved

- **Phase 20 Slice 1 merged** — was flagged in `2026-05-27-phase-20-slice-1-schema-migration.md` as "PR pending"; resolved by PR #53 merge with 0 fix-rounds (Gitar approved with no findings).

---

## Cross-Module Dependencies

**Upstream (this slice consumes):**
- `node:crypto.createHash('sha256')` — standard library; mirrors `packages/backend/src/ai/fingerprint.ts`.

**Downstream (consumes this slice's work):**
- **Slice 3** (endpoint + upsert + predicate) — calls `bootstrapId(...)` per imported row, `extractBootstrapIdOverride(...)` per row's markdown, and uses `normalizeChecklistText(...)` if it surfaces duplicate-collision messages that quote the canonical form.
- **Phase 21** (bootstrap prompt template, T-D55) — references the same five resolvers and the override syntax in the prompt instructions so Claude Code emits IDs the consumer recognises. The producer-side encoding is documentation, not code; the source-of-truth rules live here in `derive-id.ts`.

---

## Reference

- `DECISIONS.md` T-D54 — per-source-type derivation rules + universal `@bootstrap-id:` override.
- `DECISIONS.md` T-D55 — Phase 21 prompt template (downstream consumer of these rules).
- `CODE_SPEC.md` C-D20 surface 3 — derivation module location + signature + hash convention.
- `SPEC.md` §7.27 — bootstrap functional behaviour.
- Slice 1 handover: `docs/_meta/throughline/handovers/2026-05-27-phase-20-slice-1-schema-migration.md` (schema migration this slice's `bootstrap_id` values populate).
- Plan: `/root/.claude/plans/plan-mode-phase-20-build-misty-dove.md` (session-local).
- Tracking issue: [#52](https://github.com/jaydomains/throughline/issues/52).
- Chain state: `.claude-code/auto-continue-state.json`.
- PR: pending.
