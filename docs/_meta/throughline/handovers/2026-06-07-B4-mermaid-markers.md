# Throughline — Handover: Slice B4 (Mermaid deferral markers)

**Status:** final — approved by executor
**Generated:** 2026-06-07 15:40 UTC
**Last commit SHA:** _(merge SHA assigned by execution-overseer at merge)_ — 2026-06-07
**Previous handover:** `docs/_meta/throughline/handovers/2026-06-07-B3-required-reading.md` (B3)
**Slice:** B4 of the audit-remediation cohort. **PR:** _(draft)_. **Ratification: class-(ii) (M-4 settled).**

---

## Build State vs Spec

| Plan deliverable (B4, §5) | State | Evidence |
|---|---|---|
| `*(deferred)*` on SPEC §7.21 prose | built | `SPEC.md:415` heading + `:417` note |
| `*(deferred)*` on the §9 AI-feature table row (locus-corrected from §13) | built | `SPEC.md:550` |
| Remove orphaned SettingsView mermaid row | built | `SettingsView.tsx` `FEATURE_OVERRIDES` (mermaid gone) |
| T-D14 cross-note (executor's call, recommended) | built | `SPEC.md:656` |
| §15 API-account table left (capability prereq) | left (per plan) | `SPEC.md:712` unchanged |
| CODE_SPEC §14 mermaid default marked (completeness) | built | `CODE_SPEC.md:1038` |

## Last Decision Minted

> No new decision. B4 executes the settled **M-4** ruling (defer mermaid; mark, don't build). Class-(ii) spec amendment; T-D14's substance is unchanged (mermaid stays an export-only format) — only a deferral cross-note is added.

## Active Blockers

_none._ (Class-(ii) merge — M-4 is settled in the authenticated dispatch brief, so ratification collapses; overseer confirms, like A2/B1.)

## Files Changed Since Last Handover

**New:** B4 wake-log; this handover.
**Modified:** `SPEC.md` (§7.21 heading+note, §9 row, T-D14 cross-note); `CODE_SPEC.md` (§14 row); `packages/frontend/src/views/SettingsView.tsx` (removed `'mermaid'` from `FEATURE_OVERRIDES`).

## Drift Flags

| Flag | What | How resolved |
|---|---|---|
| Locus | Ruling/audit say "§13's AI table"; it's actually §9 | Marked §9 (verified headers); plan §0 already corrected this. |
| Completeness beyond deliverable list | Plan listed SPEC + SettingsView; CODE_SPEC §14 also had an unmarked mermaid default | Marked it too — B4's verification bar ("no unmarked mermaid claim") + `FEATURE_OVERRIDES` cites §14, so leaving it would be inconsistent. Same class-(ii) M-4 amendment. Flagged. |

## Open Questions

_none for B4._

## Recently Resolved

- **M-4** — mermaid generation (spec-anchored T-D14 but unbuilt) is now consistently marked `*(deferred)*` across SPEC §7.21/§9/T-D14 and CODE_SPEC §14, and the orphaned live Settings model-override knob is removed. No implementation-implying mermaid claim remains unmarked — the "cardinal sin" (claimed-but-unbuilt, undeferred) is closed for mermaid.

## Cross-Module Dependencies

**Downstream:** **D3** (next; edits SPEC §7.27 — serializes with B4 on SPEC.md, sequential so no conflict). **M-10** folds nothing here.

## Verification

- `grep -i mermaid SPEC.md CODE_SPEC.md` → every hit marked `*(deferred)*` except the §15 API-account prerequisite list (left per plan); `grep -i mermaid SettingsView.tsx` → none.
- Gate: typecheck ✓ · test ✓ (610 / 204 — `FEATURE_OVERRIDES` is a plain string array; no test/type referenced `'mermaid'`) · lint ✓ · build ✓.

## Reference

- Plan §5 B4 (+ §0 locus correction, §4 class-(ii) flag); audit `2026-06-06-end-to-end-summary.md` (M-4); SPEC §7.21/§9/§14-index/T-D14; CODE_SPEC §14.
- PR: _(draft)_.
