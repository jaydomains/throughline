# Executor wake-log — Slice D2 (IntelligenceView UUID picker)

**Slice:** D2 of the audit-remediation plan. **Finding:** M-3 (IntelligenceView retro/stakeholder/chat required raw-UUID entry, no picker).
**Branch:** `claude/d2-uuid-picker` → base `main` (@ `c3c1db4`, through C1).
**Counterparts:** execution-auditor (`claude/sharp-cerf-mZ381`), execution-overseer (`claude/blissful-brown-POKvS`).
**Ratification:** **not a class** — frontend UX only; SPEC §7.18 is silent on the selection mechanism (no spec change). Normal-class → auto-merges.

One line per event: last-seen remote HEAD (`git ls-remote`), set-diff, per-thread `X/5`.

---

- **2026-06-07** — Implementation commit. Last-seen remote: `main` `c3c1db4`, auditor `1bfb519`, overseer `92920fe` (`git ls-remote`). Set-diff: **0 dropped / 0 added (baseline)**. Threads: none.
  - **Scope (M-3):** replaced the raw-UUID text inputs with a picker (dropdown over the project's sessions/items; human-readable labels → UUID under the hood).
    - `components/EntityPicker.tsx` — reusable `<select>` over `{id,label}[]`: placeholder + options; `onChange(id)`. Value is the UUID; label is the name/title.
    - `views/IntelligenceView.tsx` — added `useSessions`/`useItems`; **retro** → session picker, **stakeholder** → item picker, **chat (context=session)** → session picker. The downstream calls (`sessionRetro`/`getStakeholderView`/`getChatHistory`/`sendChat`) receive the selected UUID exactly as the manual entry did. Switching chat context type now resets the id (avoids a stale cross-type id).
  - **Chat dump_zone retains a text input (scoped, intentional):** a `dump_zone` chat `context_id` is a **free-form non-entity** context (stored as-is, not a session/item), so the picker — explicitly "over the project's sessions/items" — doesn't apply; the dump_zone branch keeps the text input. The UUID pain M-3 flagged (session/item entry) is gone.
  - **Tests:** `test/entityPicker.test.tsx` (2 — renders placeholder+labels valued by id; selection fires `onChange(id)` not the label) + updated `test/intelligenceView.test.tsx` (seed sessions/items so the pickers have options; `pickerReady()` awaits the async-loaded options; the retro/stake/chat-session selections still resolve to `sess-9`/`item-7`/`sess-3` → same API calls as before). dump_zone test unchanged (still a text input).
  - **Verification:** gate green — typecheck · test (610 backend / **214** frontend) · lint · build. `grep 'placeholder="session id"|"item id"'` → none remain on these surfaces. Selecting an entity drives the identical downstream call (asserted).
  - **Caught by the build, fixed:** the build's `tsc -b` (which compiles test files under `noUncheckedIndexedAccess`) flagged an unchecked `select.options[0]` in the new picker test; fixed with `?.` before re-running. (Reminder: run `build`, not just `typecheck`, after adding tests — the composite build compiles test files.)
  - **Sequencing:** frontend-only, independent; no collision.
