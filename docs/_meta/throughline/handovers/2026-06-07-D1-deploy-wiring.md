# Throughline — Handover: Slice D1 (deployment wiring + single-command setup)

**Status:** final — approved by executor
**Generated:** 2026-06-07 10:15 UTC
**Last commit SHA:** _(merge SHA assigned by execution-overseer at merge)_ — 2026-06-07
**Previous handover:** `docs/_meta/throughline/handovers/2026-06-07-A3-residual-sweep.md` (A3 / Group A close)
**Slice:** D1 of the audit-remediation cohort. **PR:** _(D1 draft)_.

---

## Build State vs Spec

| Plan deliverable (D1, §5) | State | Evidence | Notes |
|---|---|---|---|
| `start` runs the built artifact | built | `packages/backend/package.json` (`start: node dist/index.js`) | dev stays `tsx watch` |
| OS units run the built artifact | built (inherited) | `docs/install/auto-start.md` | units invoke `pnpm … start` → now `node dist/index.js` |
| `auto-start.md` made truthful + build-first explicit | built | `auto-start.md` "Setup first" + "backend command" | claim `:12-13` now accurate |
| Single-command setup (DoD §11) — **primary path: provide it** | built | `scripts/setup.sh` (exec) + root `package.json` `start` | makes SPEC §11/§3 true, **no spec edit** |
| SPEC §11 single-command claim true | built | SPEC `:601`/`:51` now satisfied by `scripts/setup.sh` | fallback (SPEC amend) **not** taken |

## Last Decision Minted

> No new decisions minted. D1 makes the existing SPEC §11/§3 single-command-setup claim **true** by providing the setup (the "make the claim true" approach, mirroring C1's intent). No SPEC/CODE_SPEC/DECISIONS or anchor touched.

## Active Blockers

_none._

## Files Changed Since Last Handover

**New:**
- `scripts/setup.sh` — single-command setup (executable): `pnpm install` + `pnpm -r build` + run/auto-start guidance.
- `docs/_meta/throughline/plans/2026-06-07-audit-remediation-D1-executor-wake-log.md`; this handover.

**Modified:**
- `packages/backend/package.json` — `start: tsx --conditions=development src/index.ts` → `node dist/index.js`.
- `package.json` (root) — added `start: pnpm --filter @throughline/backend start`.
- `docs/install/auto-start.md` — "Setup first" section; corrected `start`-runs-`dist` claim; explicit build-first requirement; `pnpm start`.

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Ratification class | — | Plan §4 flags D1 class-(ii) **conditional** (only if the SPEC §11 fallback is taken) | Took the **primary** path (provide the setup) → no SPEC edit → **not** a ratification class. |
| Script-name avoidance | `package.json` | `pnpm setup` is a pnpm builtin | Named the single command `scripts/setup.sh` (+ root `start`); did **not** add a `setup` npm script (would shadow the builtin). |

## Open Questions

_none for D1._

## Recently Resolved

- **M-2 fully closed.** The deploy path now runs the built `dist/index.js` under production module resolution (was uncompiled TS via `tsx --conditions=development`); the three OS units inherit it; `auto-start.md` is truthful; and DoD §11's single-command setup exists (`scripts/setup.sh`). The audit's "systemd sets NODE_ENV=production while invoking the dev resolver" contradiction is gone.

## Cross-Module Dependencies

**Upstream:** the backend serves the built frontend SPA from `packages/frontend/dist`, so the single-command setup builds **all** packages (shared → frontend → backend).
**Downstream:** **M-10** (final PLATFORM_STATUS) folds the "deploy path fixed / single-command setup shipped" state; **B6** (README) can reference the honest deploy story. The A2 onnxruntime-node native-install footprint is relevant here (optional, lazy, T-D60 fallback).

## Verification

- **`./scripts/setup.sh`** runs clean from the repo: `pnpm install` + `pnpm -r build` (shared → frontend → backend), prints run/auto-start guidance.
- **`pnpm start`** (= `pnpm --filter @throughline/backend start` = `node dist/index.js`) boots under `NODE_ENV=production` on `127.0.0.1:47823`: `/health` → `{"ok":true}`; **`/` (SPA root) → 200** (built frontend served); clean shutdown.
- **Gate:** typecheck ✓ · test ✓ (610 backend / 204 frontend) · lint ✓ · build ✓.

## Reference

- Plan §5 D1 (+ §4 conditional ratification flag); audit `2026-06-06-end-to-end-summary.md` (M-2); SPEC §3/§11; `packages/backend/src/routes/web.ts` (frontend serving); C-D22 (source-vs-built export).
- PR: _(D1 draft)_.
