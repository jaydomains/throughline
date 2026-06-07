# Executor wake-log — Slice B4 (Mermaid deferral markers)

**Slice:** B4 of the audit-remediation plan. **Finding:** M-4 (mermaid spec-anchored but unbuilt + undeferred + orphaned Settings knob).
**Branch:** `claude/b4-mermaid-markers` → base `main` (@ `02871df`, through B3).
**Counterparts:** execution-auditor (`claude/sharp-cerf-mZ381`), execution-overseer (`claude/blissful-brown-POKvS`).
**Ratification:** class-(ii) spec amendment (SPEC + CODE_SPEC). M-4 settled in the dispatch brief → ratification collapses (overseer confirms M-4 is in its authenticated brief, per the A2/B1 precedent; **not** a new in-session ruling).

One line per event: last-seen remote HEAD (`git ls-remote`), set-diff (`N dropped / M added`), per-thread `X/5`.

---

- **2026-06-07** — Implementation commit. Last-seen remote: `main` `02871df`, auditor `edad1f1`, overseer `63b286a` (`git ls-remote`). Set-diff: **0 dropped / 0 added (baseline)**. Threads: none.
  - **Scope (M-4):** added `*(deferred)*` markers to every implementation-implying mermaid claim and removed the orphaned live Settings knob.
    - `SPEC.md` §7.21 heading + a "deferred (M-4)" prose note (covers the §7.21 body); §9 AI-feature table row (`Mermaid generation *(deferred)*`); T-D14 decision-index row (cross-note "generation deferred — see §7.21").
    - `CODE_SPEC.md` §14 per-feature-default row (`Mermaid generation *(deferred …)*`).
    - `packages/frontend/src/views/SettingsView.tsx` — **removed** the orphaned `'mermaid'` entry from `FEATURE_OVERRIDES` (the live model-override knob for the unbuilt feature). `grep mermaid SettingsView.tsx` → none.
  - **Locus correction (plan §0/B4, confirmed):** the ruling/audit say "§13's AI table," but the AI-feature table is in **§9** (line 550, under `## 9. AI role`); §13 is "Open questions" (no AI table). Marked §9. Verified by reading the headers.
  - **Completeness beyond the plan's SPEC-only deliverable list (flagged):** the plan listed SPEC + SettingsView; I also marked **CODE_SPEC.md §14** because (a) B4's own verification bar is "*no implementation-implying mermaid claim remains unmarked*," (b) `FEATURE_OVERRIDES` explicitly cites "CODE_SPEC §14," so removing the SettingsView knob while leaving §14's mermaid default would be internally inconsistent. Same class-(ii) M-4 amendment (CODE_SPEC is a spec record); not a scope expansion beyond M-4 — completion of its bar (evidence/verification-bar over the imprecise deliverable list, as in B1).
  - **Left intentionally (per plan):** `SPEC.md §15` API-account table (`…mermaid, stakeholder…`) — a capability-prerequisite list, not a shipped-feature claim.
  - **Verification:** gate green — typecheck · test (610 backend / 204 frontend; no test asserted the mermaid knob — `FEATURE_OVERRIDES` is a plain string array, no type/test break) · lint · build. No implementation-implying mermaid claim remains unmarked.
  - **Sequencing:** B4 serializes with **D3** on `SPEC.md` (D3 is next; no concurrency — one slice at a time). Auto-continue posture now in force (spec-author ruling 2026-06-07) — passed to the reviewers via PR comment.
