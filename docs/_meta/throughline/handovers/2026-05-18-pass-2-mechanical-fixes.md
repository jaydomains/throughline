<!-- Template version: 1.0 -->

# Throughline — Pass 2 (mechanical pre-launch fixes) Handover

**Generated:** 2026-05-18 (UTC, pre-merge — planned merge date)
**Last commit SHA:** see PR #28 head — branch `claude/throughline-pass-2-fixes-Hadys` (PR not yet merged; update to merge SHA on merge). This handover is part of the Slice-5 commit, per authoring rule 1.
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-17-ui-redesign-design-system.md` (UI Redesign — full design-system adoption)

Not a ROADMAP phase. The mechanical subset of the v1 pre-launch verification findings — the items that need no spec-author decision. One PR (#28), five slice commits + one inline Gitar fold-in. No SPEC functional change; no new T-D/C-D anchors.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Lint config real, not a no-op (build discipline) | built | `eslint.config.js`, root + 3 package `package.json`, CHECKLIST Pass-2 Slice 1 | `@eslint/js`+`typescript-eslint` declared; scripts run real `eslint`; 23 surfaced findings fixed; `pnpm -r lint` clean |
| Companion `listRuns` newest-first is deterministic | built | `methodology/companion/engine.ts` `ORDER BY started_at DESC, rowid DESC` | ms-precision ISO ties were non-deterministic (companion.test.ts:294 flake); now a production guarantee |
| Inbox watcher `stop()` idempotent | built | `inbox/watcher.ts`; `test/inbox.test.ts` "inbox watcher" | memoised `stopping` promise; watcher nulled after close |
| Reconcile `session_id` validated before write | built | `reconcile/service.ts`; `test/reconcile.test.ts` | one normalised `sessionId` feeds items query / engine / INSERT / audit; post-write `UPDATE…NULL` deleted; final state identical |
| Gate-trigger explicit-project guard | built | `methodology/gates/routes.ts`; `test/server.test.ts` "POST /api/gate-trigger" | unknown `project_id` → 404 (sibling-consistent); no-`project_id` loopback unchanged |
| `SessionsIndex` refresh awaited | built | `hooks/useSessions.ts`, `views/SessionsIndex.tsx`; `test/sessionView.test.tsx` | `refresh` returns `Promise<void>`; awaited before `navigate` |
| README accurate; CLI discoverable via `--help` | built | `packages/backend/src/cli/index.ts`, `README.md` | `--help`/`-h`/`help` → stdout exit 0; misuse → stderr exit 2; README points at `--help`; auto-run wording unified; discipline docs added to the Documentation table |

CHECKLIST §Pass 2: all five slice sections ticked. Suite: backend **265/265**, frontend **118/118**, `pnpm -r lint` clean, `pnpm -r typecheck` clean, `pnpm build` clean.

---

## Last Decision Minted

> No new decisions minted. Implementation followed existing decisions/specs (C-D7 late-bound binding for the `prefer-const` config option; SPEC §7.12 / sibling gate routes for the gate-trigger guard; T-D5/§7 reconcile and inbox semantics unchanged). Implementation-shape choices: ESLint wired (config already existed and is sound; eslint already a devDep — direction user-approved in plan); `prefer-const` set to `{ ignoreReadBeforeAssign: true }` (the rule's own option, not a code contortion); no `eslint-plugin-react-hooks` added (kept config minimal — one dead inline-disable replaced with a plain WHY note). All recorded in `CHECKLIST.md` §Pass 2.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-18-pass-2-mechanical-fixes.md` — this file.

**Modified (by area):**
- Lint wiring: `eslint.config.js`, root `package.json` (`type:module`, 2 devDeps), `packages/{shared,backend,frontend}/package.json` (real `lint`), `pnpm-lock.yaml`; ~15 src/test files for the surfaced findings (import-type hoists, unused vars, `prefer-const`, dead react-hooks disable).
- Backend robustness: `methodology/companion/engine.ts`, `inbox/watcher.ts`, `test/inbox.test.ts`.
- Backend boundary validation: `reconcile/service.ts`, `methodology/gates/routes.ts`, `test/reconcile.test.ts`, `test/server.test.ts`.
- Gitar fold-in (Slice-1 finding, applied in Slice 2): `backup/service.ts`, `server.ts`, `test/backup.test.ts` (dead `dbPath` fully removed).
- Frontend: `hooks/useSessions.ts`, `views/SessionsIndex.tsx`, `test/sessionView.test.tsx`.
- CLI/docs: `packages/backend/src/cli/index.ts`, `README.md`.
- `CHECKLIST.md` — Pass-2 section, five slices + close note.

**Deleted:** _none_ (a dead interface field and a dead test interface were removed in-place).

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Lint blast radius unknown at plan time | repo-wide | Plan said "small"; measured 23 findings (16 err / 7 warn) before approval | Wired + all fixed in Slice 1; no rule disabled wholesale |
| `prefer-const` false-positive on late-bound binding | `eslint.config.js`, `server.ts` | `disciplineEngine` is declared-then-assigned (C-D7), can't be `const` | Used the rule's own `ignoreReadBeforeAssign` option — config, not code contortion |
| Pre-existing unrelated test flake surfaced | `test/server.test.ts` backup/export | Adding a test increased parallel load; backup/export shares a fixed `tmpdir()/throughline-backup` with concurrent files | **Not** in the Pass-2 scope list; left untouched (passes isolated and on re-run). Noted in CHECKLIST as a known pre-existing condition |
| Gitar Slice-1 finding applied mid-Slice-2 | `backup/service.ts` etc. | `dbPath` half-removed by the Slice-1 unused-var fix | Fully removed from interface + all callers, folded into Slice 2 with attribution (no manual gate per task) |

---

## Open Questions

- [ ] Pre-existing `server.test.ts` backup/export flake — concurrent test files share a fixed `tmpdir()/throughline-backup`. Landing site: a test-hygiene slice (out of the Pass-2 verification scope; not introduced here).
- [ ] Spec-author items deliberately untouched: Q5/Q6/Q7 + the 7 CODE_SPEC "Questions for the spec author"; the 4 `<!-- RATIONALE NEEDED -->` markers (T-D10/15/17/23); AI callsite↔settings-panel key asymmetry; the two Pass-1b GraphView spec gaps (WN-1b-a/b); voice-input language default; cost-threshold default; all v1.x items. Landing site: spec-author sessions, per SESSION_START "surface, do not silently resolve".

---

## Recently Resolved

- **Phase-6a no-op lint flag** — carried as `echo 'no lint config' && exit 0` since Phase 6a; closed (ESLint wired, Slice 1).
- **`companion.test.ts:294` ordering flake** — flagged in the v1 pre-launch verification findings; fixed at the source via a stable `rowid` tiebreaker (Slice 2).
- **Inbox watcher non-idempotent stop / reconcile write-then-validate / gate-trigger loopback guard / SessionsIndex non-awaited refresh** — all flagged in the verification findings; resolved in Slices 2–4.
- **README discipline-doc discoverability / auto-run wording / CLI subcommand list** — flagged in the verification findings; resolved in Slice 5.
- **Gitar dead-`dbPath` finding (PR #28)** — raised on Slice 1; fully resolved in Slice 2.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** `projects.get` (gate-trigger guard); `sessions.get` (reconcile validation); existing `useSessions`/`api.listSessions` (frontend); the ESLint flat config + `eslint`/`@eslint/js`/`typescript-eslint`. All read-only / additive.

**Downstream (consumes this slice):** `pnpm -r lint` is now a real gate any future slice/CI can rely on. No API/contract change — behaviour is preserved everywhere (validation moved earlier; ordering made deterministic; help routed to stdout). No pending consumers.

---

## Reference

- Docs operated against: `SPEC.md` (§7.12 gate-trigger, §7.6 inbox — no functional change), `CODE_SPEC.md` (C-D7 referenced for the `prefer-const` option), `CHECKLIST.md` (§Pass 2), `SESSION_START.md`, `README.md`, `docs/install/auto-start.md`.
- PR: #28 — https://github.com/jaydomains/throughline/pull/28
