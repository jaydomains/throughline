<!-- Template version: 1.0 -->

# Throughline — UI Redesign (full design-system adoption) Handover

**Generated:** 2026-05-17 (pre-merge — planned merge date)
**Last commit SHA:** see PR #27 head — branch `claude/ui-redesign-design-system-Fp48q` (update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-17-pass-1b-graphview.md` (Pass 1b — GraphView implementation)

Not a ROADMAP phase. A visual-layer redesign adopting the design handoff (`docs/_meta/throughline/mockups/THROUGHLINE/design_handoff_throughline_ui/`) over the unchanged data model and view-mode plumbing. One PR (#27), four slice commits plus inline Gitar-finding fixes. No SPEC functional change.

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Design-handoff token system adopted app-wide (3 directions × 2 themes × 3 densities) | built | `packages/frontend/src/styles.css` token head; `CHECKLIST.md` Slice 1 | `:root` A·dark fallback so the cascade never resolves unstyled |
| Offline posture preserved (no Google Fonts CDN) | built | `packages/frontend/src/fonts.css` (`@fontsource`, latin subset); build emits woff2 | Corrects the handoff README's CDN `<link>` — user chose self-host |
| GraphView reconciled into the global token system | built | `packages/frontend/src/views/graph/graph.css`; DECISIONS WN-1b-c resolved | Scoped `--gv-*` block deleted |
| Sidebar shell replaces ViewToggle; grid-template-areas layout | built | `components/Sidebar.tsx`, `Icon.tsx`, `Wordmark.tsx`, `App.tsx`, `styles.css` shell block | Visibility predicates preserved from `views/modes.ts` |
| Pill/tag/rounding declass | built (global pass) | `styles.css` DECLASS block | Single global pass per handoff README step 3 — not 25 per-file edits |
| HomeView promoted to a real surface | built | `views/HomeView.tsx`; `test/homeView.test.tsx` | CC-timeline + phase card omitted (no backing data — not faked) |
| CaptureView first-class + route | built | `views/CaptureView.tsx`, `App.tsx` route, `Sidebar.tsx` entry | Embeds existing DumpZone; review modal unchanged (T-D5) |
| Per-screen polish (Session/Gates/Drift) | partial | `styles.css` shared vocabulary | Deep structural restyle of those screens' markup deferred (see Drift Flags) |
| Theme switcher + SSE hot-reload + light + B/C + density | built | `routes/events.ts` hub, `settings/service.ts` onChange, `theme.ts`, `useSSE.ts`, `App.tsx`, `SettingsView.tsx` | SSE settings-changed producer built from scratch (channel only had welcome/ping) |
| FOUC-safe early theme fetch | built | `main.tsx` (`getSettings` → `applyTheme` before mount) | Default fallback on failure |
| Suite green | built | frontend 118/118, backend 261/261, `pnpm -r typecheck` clean, both builds clean | |

---

## Last Decision Minted

> No new T-D / C-D anchors minted (SESSION_START anchor convention). Implementation-shape choices: self-hosted fonts via `@fontsource` instead of CDN (offline posture, user-confirmed); global CSS declass pass instead of 25 per-component edits (matches handoff README step 3); SSE fan-out hub added to the existing channel. **DECISIONS WN-1b-c resolved** (GraphView scoped tokens reconciled into the global system). No SPEC functional change — visual layer over the unchanged data model.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:** `src/fonts.css`, `src/theme.ts`, `components/Icon.tsx`, `components/Wordmark.tsx`, `components/Sidebar.tsx`, `views/HomeView.tsx`, `views/CaptureView.tsx`, `test/sidebar.test.tsx`, `test/theme.test.ts`, backend `test/events.test.ts`, this handover.

**Modified (by area):** frontend shell (`App.tsx`, `Header.tsx`, `main.tsx`, `styles.css`, `views/graph/graph.css`, `hooks/useSSE.ts`, `views/SettingsView.tsx`, `views/stubs.tsx`); backend SSE/settings (`routes/events.ts`, `server.ts`, `settings/service.ts`, `settings/routes.ts`); tests (`homeView`, `directives`, `stubs`, `settingsView`, backend `settings`); `CHECKLIST.md`, `DECISIONS.md`, `package.json`/lockfile (font deps).

**Deleted:** `components/ViewToggle.tsx`, `test/viewToggle.test.tsx` (replaced by `Sidebar` + `sidebar.test.tsx`); HomeView stub removed in-place from `views/stubs.tsx`.

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Fonts: CDN vs offline | `src/fonts.css` | Handoff README loads 6 Google Fonts via CDN — contradicts offline posture | User chose self-host; vendored via `@fontsource`, woff2 bundled by Vite |
| Declass scope | `styles.css` | Plan implied ~25 component edits; handoff README itself says "single global pass" | One intentional global declass block instead — lower blast radius, same outcome |
| Per-screen polish depth | Session/Gates/Drift/DumpZone | Slice 3 "per-screen polish" — full markup restyle is large and risks selector tests | Shared vocabulary applied via stylesheet; deep structural restyle (DumpZone `.dz`/`.review-sheet`, detail-panel slide-in) deferred — flagged here + in CHECKLIST |
| HomeView omissions | `views/HomeView.tsx` | Handoff Home spec includes CC-push timeline + methodology phase card | Omitted (no backing data) rather than faked — same honesty stance as Pass 1b deferred edges |
| Gitar findings applied mid-next-slice | PR #27 | Slice-N findings arrived while Slice N+1 in flight | Applied inline; folded into the next slice commit with explicit attribution (no manual gates per task) |

---

## Open Questions

- [ ] Deep per-screen restyle of Session / Gates / Drift / DumpZone markup to the handoff's `.dz` / `.review-sheet` / `.detail-panel` slide-in patterns — landing site: a follow-up polish pass (visual-only; data flows unchanged).
- [ ] Carried from Pass 1a/1b: WN-1b-a / WN-1b-b (spec-author decisions), other v1 pre-launch Cat-2/3 residue — untouched here.

---

## Recently Resolved

- **WN-1b-c (full design-system adoption)** — flagged in `2026-05-17-pass-1b-graphview.md` as the deferred redesign pass; resolved by Slice 1 (global token system; `--gv-*` deleted; `DECISIONS.md` WN-1b-c marked resolved).
- **Pass-1b downstream note** "a future design-system redesign pass must reconcile the scoped tokens" — done in Slice 1.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** existing hooks (`useItems`/`useDriftInbox`/`useDirectives`/`useCostMeter`/`useItemPolicy`/`useSessions`/`useStaleThreshold`), `settings` store, the `/events` SSE channel, `DumpZone`/`DumpZoneReviewModal`, `views/modes.ts` visibility predicates — all read-only / additive.

**Downstream (consumes this slice):** any future polish pass consumes `styles.css` vocabulary + `theme.ts`; future SSE producers reuse `createSSEHub` (`routes/events.ts`) and the `settings` `onChange` hook.

---

## Reference

- Docs operated against: `SPEC.md` (no functional change), `CODE_SPEC.md` (§1 SSE, §19 settings — implementation-shape), `DECISIONS.md` (WN-1b-c resolved), `CHECKLIST.md` (UI Redesign section), `SESSION_START.md`.
- Design handoff: `docs/_meta/throughline/mockups/THROUGHLINE/design_handoff_throughline_ui/README.md`, `prototype/theme.css`.
- PR: https://github.com/jaydomains/throughline/pull/27
