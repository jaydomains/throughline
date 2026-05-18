<!-- Template version: 1.0 -->

# Throughline — Spec Clarification: Q5/Q6/Q7 Close-out Handover

**Generated:** 2026-05-18 (UTC, pre-merge — planned merge date)
**Last commit SHA:** see PR head — branch `claude/resolve-spec-questions-ybwen` (PR not yet merged; update to merge SHA on merge). This handover is part of the slice commit, per authoring rule 1.
**Previous handover:** `docs/_meta/throughline/handovers/2026-05-18-pass-2-mechanical-fixes.md` (Pass 2 — mechanical pre-launch fixes)

Not a ROADMAP phase. Docs-only spec-author resolution slice closing the three open Q5/Q6/Q7 questions in `CODE_SPEC.md`'s "Questions for the spec author" section. All three are ratify-as-built: no code, no new T-D/C-D anchors; anchor bodies revised in place (anchor IDs retained, canonical via SPEC §14 — same pattern as T-D27 during the Semble spec-clarification).

---

## Build State vs Spec

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| Q5 — eleven-section H2 grammar formalised; one bundle.md/dir v1, multi-file v2 possibility | built | `SPEC.md` §7.1 "Bundle file grammar"; `CODE_SPEC.md` C-D3 Rationale ratification note | Matches C-D3 as built |
| Q6 — companion mode = bundle-declared identifier; v1 = template selection only; richer coupling deferred to a worked example | built | `SPEC.md` §7.18 "Companion modes"; `CODE_SPEC.md` C-D9 Rationale ratification note | "deferred", not "template-only forever" |
| Q7 — annotation-contract boundary; Semgrep = v1 reference tool; annotation-generic | built | `SPEC.md` §7.16 heading+body+rule-convention; §10/§13/§14 cells; `DECISIONS.md` T-D26 Rationale; `CODE_SPEC.md` C-D16 bullet | SPEC §7.16 ↔ T-D26 reconciled |
| CODE_SPEC Questions items 5–7 closed with SPEC refs | built | `CODE_SPEC.md` L904–906 | Items 8–9 remain open |
| CHECKLIST provisional notes retired + close-out section | built | `CHECKLIST.md` L265, L319, "Spec clarification — Q5/Q6/Q7 close-out" | Pass-2 L490/L532 history left verbatim |
| Companion-mode declaration order is a real guarantee (default = first-declared) | verified | `bundle-parser/review-patterns.ts` ordered-array build; `session-start/engine.ts` `resolveMode`/`modes` use `modes[0]` | Verified in code per user request — wording stands |
| No code touched | built | `git diff --stat` — only the 4 docs + this handover | Docs-only |

CHECKLIST §"Spec clarification — Q5/Q6/Q7 close-out": all rows ticked. No test/lint/build run — documentation-only slice, no source changed.

---

## Last Decision Minted

> No new decisions minted. All three resolutions are ratify-as-built against existing anchors: C-D3 (Q5 — H2 grammar / one-bundle.md-per-dir), C-D9 (Q6 — bundle-declared companion-mode enum + first-declared default), C-D16 / T-D26 (Q7 — annotation-contract boundary, Semgrep as v1 reference tool). Anchor bodies were revised in place with ratification notes; anchor IDs retained (canonical via SPEC §14), matching the T-D27 Semble-clarification pattern. No new T-D/C-D anchors.

---

## Active Blockers

_none_

---

## Files Changed Since Last Handover

**New:**
- `docs/_meta/throughline/handovers/2026-05-18-spec-clarification-q5-q6-q7-closeout.md` — this file.

**Modified:**
- `SPEC.md` — §7.1 new "Bundle file grammar" para (Q5); §7.16 heading + lead + rule-convention para reframed to the annotation contract (Q7); §7.18 new "Companion modes" para (Q6); §10 integration row, §13 dependency row, §14 T-D26 summary row reconciled (Q7).
- `CODE_SPEC.md` — Questions items 5/6/7 closed ("resolved per SPEC §…"); C-D3 Rationale + C-D9 Rationale ratification notes; C-D16 verifier-tool-plurality bullet flipped to resolved.
- `DECISIONS.md` — T-D26 Rationale tightened to the annotation-contract boundary (anchor retained, no new anchor).
- `CHECKLIST.md` — Phase-13 (L319) and Phase-10 (L265) provisional notes retired to cite the resolutions; new "Spec clarification — Q5/Q6/Q7 close-out" section appended.

**Deleted:**
- _none_

---

## Drift Flags

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| §7.18 "default = first-declared mode" wording needed a code guarantee, not just intent | `bundle-parser/review-patterns.ts`, `session-start/engine.ts` | Plan asserted the default by intent; user required code verification | Verified the parser builds `companion_modes` as an ordered array (sequential regex `.exec()` in document order; inline CSV split in order — no hash-map traversal) and `resolveMode`/`modes` use `modes[0]`; wording is accurate as built and left as written |

---

## Open Questions

- [ ] CODE_SPEC "Questions for the spec author" items **8** (voice-input language default) and **9** (cost-meter daily-threshold default) remain open — recommendation requests, untouched here. Landing site: a future spec-author session.
- [ ] The four `<!-- RATIONALE NEEDED -->` markers (T-D10/15/17/23), AI callsite↔settings-panel key asymmetry, the two Pass-1b GraphView gaps (WN-1b-a/b) — all still open, out of this slice's scope. Landing site: spec-author sessions, per SESSION_START "surface, do not silently resolve".

---

## Recently Resolved

- **Q5 / Q6 / Q7** — flagged in `2026-05-18-pass-2-mechanical-fixes.md` Open Questions ("Spec-author items deliberately untouched: Q5/Q6/Q7 …") and standing in `CODE_SPEC.md` "Questions for the spec author" since the v5.1 regeneration; resolved here by spec-author decision (ratify-as-built) across SPEC §7.1/§7.16/§7.18 + the §10/§13/§14 cells, DECISIONS T-D26, CODE_SPEC C-D3/C-D9/C-D16, and CHECKLIST.

---

## Cross-Module Dependencies

**Upstream (this slice consumes):** spec-author resolutions for Q5/Q6/Q7 (provided in the task). Code read-only to verify the companion-mode declaration-order guarantee (`bundle-parser/review-patterns.ts`, `session-start/engine.ts`) — no code change.

**Downstream (consumes this slice):** none pending. The anchors (C-D3/C-D9/C-D16/T-D26) are now self-consistent across SPEC/CODE_SPEC/DECISIONS/CHECKLIST; any future bundle-grammar, companion-mode, or verifier-tool work reads the ratified contract. No API/contract change.

---

## Reference

- Docs operated against: `SPEC.md` (§7.1, §7.16, §7.18, §10, §13, §14), `CODE_SPEC.md` (Questions, C-D3, C-D9, C-D16), `DECISIONS.md` (T-D26), `CHECKLIST.md`, `SESSION_START.md`, `HANDOVER_TEMPLATE.md`. Code read-only: `packages/backend/src/methodology/bundle-parser/review-patterns.ts`, `packages/backend/src/methodology/session-start/engine.ts`.
- PR: <link or number — fill on PR open>
