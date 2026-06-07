# Throughline / frontend — Handover: Slice D2 (IntelligenceView UUID picker)

**Status:** final — approved by executor
**Generated:** 2026-06-07 19:50 UTC
**Last commit SHA:** _(merge SHA assigned by execution-overseer at merge)_ — 2026-06-07
**Previous handover:** `docs/_meta/throughline/handovers/2026-06-07-C1-markdown-export.md` (C1)
**Slice:** D2 of the audit-remediation cohort. **PR:** _(draft)_. **Not a ratification class.**

---

## Build State vs Spec

| Plan deliverable (D2, §5) | State | Evidence |
|---|---|---|
| Reusable session/item picker component | built | `components/EntityPicker.tsx` (label→UUID `<select>`) |
| Three call-sites converted | built | `IntelligenceView.tsx`: retro (session), stakeholder (item), chat-session (session) |
| Frontend tests covering selection → UUID resolution | built | `entityPicker.test.tsx` (2) + updated `intelligenceView.test.tsx` |
| No raw-UUID entry remains on these surfaces | built | `grep 'placeholder="session id"/"item id"'` → none (chat dump_zone retains text — non-entity context) |
| Selecting drives the same downstream call | built | retro/stake/chat tests assert identical `sessionRetro`/`getStakeholderView`/`sendChat` calls |

## Last Decision Minted

> No new decision/anchor. UX fix — SPEC §7.18 is silent on the selection mechanism, so this is not a spec change. Not a ratification class.

## Active Blockers

_none._

## Files Changed Since Last Handover

**New:** `components/EntityPicker.tsx`; `test/entityPicker.test.tsx`; this handover; D2 wake-log.
**Modified:** `views/IntelligenceView.tsx` (useSessions/useItems + 3 pickers + chat-type id reset); `test/intelligenceView.test.tsx` (seed entities + await picker options).

## Drift Flags

| Flag | What | How resolved |
|---|---|---|
| Chat dump_zone scope | The plan said replace "the chat input"; chat has two context types | Replaced the **session** context with a picker; **dump_zone** keeps a text input because its `context_id` is a free-form non-entity context (not a session/item), outside "over sessions/items." The UUID-entry pain M-3 flagged is resolved. |
| Build-vs-typecheck | The composite `tsc -b` (build) compiles test files; a new test had an unchecked index access | Fixed with `?.`; re-ran build green. (Run `build` after adding tests, not just `typecheck`.) |

## Open Questions

_none._

## Recently Resolved

- **M-3** — IntelligenceView's retro / stakeholder / chat(session) surfaces no longer require raw-UUID entry: a dropdown over the project's sessions/items surfaces human-readable labels and resolves to the UUID, driving the same downstream calls.

## Cross-Module Dependencies

**Upstream:** `useSessions` / `useItems` (existing hooks). **Downstream:** `EntityPicker` is reusable for any future label→UUID selection. M-10 folds nothing here.

## Verification

- Gate: typecheck ✓ · test ✓ (610 backend / **214** frontend) · lint ✓ · build ✓.
- `entityPicker.test.tsx`: selection fires `onChange` with the **id** (not the label). `intelligenceView.test.tsx`: retro/stake/chat-session selections resolve to the seeded ids → identical API calls (`sessionRetro` `session_id:'sess-9'`, `getStakeholderView 'item-7'`, `sendChat context_id:'sess-3'`); dump_zone chat still uses a text `context_id`.
- No `placeholder="session id"`/`"item id"` raw inputs remain on these surfaces.

## Reference

- Plan §5 D2; audit `2026-06-06-end-to-end-summary.md` (M-3); SPEC §7.18; `useSessions`/`useItems`; `ChatContextType` (`session` | `dump_zone`).
- PR: _(draft)_.
