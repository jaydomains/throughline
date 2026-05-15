<!-- Template version: 1.0 -->

# Throughline — Spec Clarification: Gate Triggers (Q1–Q4) Handover

**Generated:** 2026-05-15 (UTC)
**Last commit SHA:** e8f51d5 — 2026-05-15 (PR #13 not yet merged; update to merge SHA on merge)
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-15-phase-7-sitemesh.md` (Phase 7 — SiteMesh bundle delivery)

---

## Build State vs Spec

Docs-only spec-clarification PR. Resolves CODE_SPEC.md *Questions for the spec author* Q1–Q4 (the four Phase 8 gate-trigger detection mechanisms). No code.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Single local-loopback transport for all four gate moments | built | `SPEC.md` §7.12 "Gate-trigger transport" | _none_ |
| Per-commit two-trigger semantics (item-transition or pre-commit hook) | built | `SPEC.md` §7.12 "Per-commit gates" para | Both triggers fire the same gate |
| Hook collision policy (advisory, chain not replace) | built | `SPEC.md` §7.12 "Hook collision policy" | T-D44 cited |
| Hook install requires explicit user consent | built | `SPEC.md` §7.12 "Hook installation and consent" | Default-checked checkbox; settings opt-in |
| Delivery guarantees (CC best-effort / hooks durable) | built | `SPEC.md` §7.12 "Delivery guarantees" | _none_ |
| T-D37 carve-out extended to consented hook install | built | `SPEC.md` §5 bullet, §14 T-D37 row | Cross-ref §7.12 |
| CODE_SPEC hook path resolution / port stability / event queue | built | `CODE_SPEC.md` §7 (3 new subsections) | simple-git named in §12 |
| Q1–Q4 removed from open Questions list | built | `CODE_SPEC.md` Questions for the spec author | Q5–Q9 numbering preserved |
| CODE_SPEC §7 trigger table reconciled | built | `CODE_SPEC.md` §7 trigger table | Removed stale "flagged for spec author" rows |

---

## Last Decision Minted

> No new decisions minted. No new T-D or C-D anchors. The clarification relies on existing anchors: T-D31 (loopback only), T-D44 (never blocks), T-D36 (audit log), T-D37 (autonomous-write carve-out, now extended to consented git-hook installation). Implementation-shape detail recorded in CODE_SPEC.md §7.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-15-spec-clarification-gate-triggers.md` — this handover.

**Modified:**
- `SPEC.md` — §7.12 per-commit clarification + four new transport/installation/delivery subsections; §5 carve-out extension; §14 T-D37 row.
- `CODE_SPEC.md` — §7 three new code-shape subsections; §7 trigger table reconciled; Questions Q1–Q4 collapsed to one resolved line.

**Deleted:**
- _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| Carve-out anchor location | `SPEC.md` | Edit brief labelled the T-D37 carve-out extension "§7"; the carve-out prose actually lives in §5 + §14 | Flagged to spec author pre-apply; landed in §5 bullet + §14 row with §7.12 cross-ref, approved |
| Trigger-table consistency | `CODE_SPEC.md` | §7 v1 trigger table still said "flagged for the spec author" — would contradict the resolved Questions list | Flagged as consistency item A; spec author approved updating the four rows in this PR |

---

## Open Questions

- [ ] Q5 (bundle markdown convention), Q6 (companion modes ↔ review patterns), Q7 (verifier-tool plurality), Q8 (voice input language default), Q9 (cost meter threshold default) remain open in `CODE_SPEC.md` *Questions for the spec author* — out of scope for this PR, numbering preserved for ROADMAP/Phase 8 references.
- [ ] Phase 8 implementation now unblocked on trigger mechanism; build lands the loopback channel, consented hook installer, and durable hook queue per the resolved spec.

---

## Recently Resolved

- Q1–Q4 gate-trigger detection mechanisms — flagged in `2026-05-15-phase-7-sitemesh.md` lineage and SESSION_START.md "Known spec-author gaps" as surface-do-not-silently-resolve; resolved by SPEC §7.12 amendments + CODE_SPEC §7 code-shape detail in PR #13.

---

## Cross-Module Dependencies

**Upstream (this module consumes):**
- _none_ (docs-only).

**Downstream (consumes this module):**
- Phase 8 methodology gate runtime — consumes the resolved trigger spec (loopback channel, consented hook install, durable queue). Not yet built; this PR unblocks it.

---

## Reference

- Spec / decisions / build-state docs this slice operates against: `SPEC.md` §5/§7.12/§14, `CODE_SPEC.md` §7 + Questions for the spec author, `SESSION_START.md` (Known spec-author gaps), `ROADMAP.md` Phase 8.
- PR: #13 — https://github.com/jaydomains/throughline/pull/13
