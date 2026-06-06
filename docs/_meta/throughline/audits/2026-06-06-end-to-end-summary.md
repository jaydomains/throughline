# Throughline — End-to-End Audit Summary

**Date:** 2026-06-06
**Audit type:** Three-session parallel-discovery audit (findings-only; no remediation).
**Repo state audited:** `main` @ `5d489ea` (HEAD at audit start).
**Sessions:** Auditor-A (full-repo overpass) · Auditor-B (full-repo overpass, parallel) · Overseer (reconciliation, slicing, depth verification, this summary).

---

## Executive summary

Throughline's **code is in good shape** — the three-layer gate (typecheck / test / lint / build) is genuinely green at HEAD, verified independently three times (610 backend + 204 frontend tests), and a systematic Definition-of-Done walk confirms the v1 feature set is **largely built**: the methodology runtime, multi-project tracker, all nine view modes, the seven capture surfaces, reconcile, library, directives, GitHub polling, gate runtime, drift detection, the RAG/intelligence layer, backup, and cost meter all exist and are wired. The gap between "feature-complete" and "deployable" is **not in the application code** — it is in three other places: (1) a **supply-chain exposure** (a knowingly-deferred dependency set carries 1 Critical + 7 High advisories under a "production-ready" claim); (2) a **deployment-wiring defect** (every documented OS auto-start path runs uncompiled TypeScript through `tsx` in *development* module-resolution mode, not the built artifact); and (3) **doc/governance drift** (the living status doc is stale by an entire cohort, the merge-method and halt-class doctrine contradicts actual practice, and the BLOCKING addressing layer denies directories its own parent commit created). Spec-vs-code drift is **narrow** — only two genuinely claimed-but-unbuilt v1 surfaces (Mermaid generation, per-session markdown export). Net: Throughline is a real, working, well-tested single-user tool whose **honest current status is "feature-complete, not yet deployable"**, and whose discipline-floor documentation has drifted behind the codebase it governs.

---

## Current state map by area

| Area | State | Notes |
|---|---|---|
| **Methodology runtime** (bundle loader, typed-section parser, gate dispatcher, discipline-drift engine, companion engine, session-start pipeline) | ✅ Built | C-D4/C-D6/C-D7/C-D8/C-D9 all present under `packages/backend/src/methodology/`. `freeform` + `test-bundle` ship under `methodologies/`. |
| **Projects / items / sessions** (multi-project, first-class items, sessions-as-views) | ✅ Built | Full lifecycle (create/switch/archive/delete) in `views/stubs.tsx::ProjectsView` (file is misnamed — it is a full implementation, not a stub). `project_id` FK model per C-D5. |
| **Nine view modes** (home, projects, sessions, modules, tree, graph, library, directives, gates) | ✅ Built | All view files present; modules/gates hide for freeform per spec. Graph carries the Phase-18 communication-model fourth layer (C-D18). |
| **Capture surfaces** (scratchpad, manual, session/library dump zone, voice, CC push, code-TODO import) | ✅ Built | Voice (37 src hits), code-todo (`code-todo/` module), inbox watcher all present. |
| **Reconcile** (six-category diff + GitHub auto-reconcile) | ✅ Built | `reconcile/` + `github/auto-reconcile.ts`; confidence-thresholded per T-D6/T-D18. |
| **Library** (5 types incl. `project_spec`), **directives** (3 types) | ✅ Built | `project_spec` one-per-project per T-D10 (E20 amendment). |
| **GitHub integration** (poller, tiers 1–4, pr-open gate, pr-linking, orphan-rules) | ✅ Built | `github/` fetch-client + local-git seam per C-D16. (Runtime behaviour not exercised — no live PAT/network in audit.) |
| **Drift detection** (code 4-tier + discipline bundle-defined) | ✅ Built | Shared `drift_signals` table per C-D7. |
| **Intelligence layer** (retro, periodic review, dependency sequencing, RAG 3-substrate + router, stakeholder, companion, session-start) | ✅ Built | periodic-review (67 hits), sequencing (46), RAG substrates+router in `intelligence/rag.ts`. |
| **Clone-and-go + bootstrap** (C-D19/20/21) | ✅ Built (one sub-action gap) | Init CLI, `.throughline/` reader, ingest, producer surfaces present. `merge_fields`/`archive` review actions deferred (M-6). |
| **Backup, cost meter, settings, secrets** | ✅ Built | Secrets `0600`, never backed up, never browser-exposed (T-D4 ✅). |
| **Command palette / keyboard nav** | ◑ Partial (by spec) | v1 partial set shipped (fuse.js, 54 hits); full target/action set + full keyboard contract explicitly deferred at E17 (§7.24). |
| **Mermaid generation** | ✗ Missing | Spec-anchored (T-D14, §7.21, §13 AI table) with an orphaned Settings model-override row, but **no implementation and no deferral marker** (M-4). |
| **Per-session markdown export** | ✗ Missing | SPEC §7.20 calls it "the shipped v1 export surface" and rests the §7.20 deferral on it; **0 implementations** (M-5). |
| **Deployment / auto-start** | ⚠️ Defective | All three OS units run `tsx --conditions=development` source, not built `dist`; no single-command setup (M-2). |
| **Dependency supply-chain** | ⚠️ Exposed | 1 Critical + 7 High + 6 Moderate advisories in the prod tree, knowingly deferred (M-1). |
| **Discipline-floor & status docs** | ⚠️ Drifted | Merge-method/halt-class doctrine vs practice; PLATFORM_STATUS stale by a cohort; REQUIRED_READING vs live tree (M-7…M-13). |

---

## Gaps from spec intent (SPEC / CODE_SPEC vs reality)

1. **Two claimed-shipped v1 surfaces are unbuilt and undeferred** — Mermaid generation (M-4) and per-session markdown export (M-5). These are the project's own cardinal sin ("silent drift is the failure," SPEC §1): unlike the many E17-descoped surfaces, which all carry explicit `*(deferred)*` markers, these are presented as live/shipped.
2. **Two bootstrap re-import sub-actions** (`merge_fields`, stale `archive`) are listed in SPEC §7.27 without a deferral qualifier but are explicitly carved out in code (M-6). Working alternatives exist (`keep_mine`/`take_theirs`/`keep`/`delete`).
3. **`@xenova/transformers` is a hard direct dependency**, not the "optional first-launch download" CODE_SPEC C-D2 describes — which is *why* the protobufjs Critical sits in every prod install's tree (relevant to M-1).
4. **DoD §11 "single-command setup"** is not met: install is clone + `pnpm install` + hand-authored OS unit (part of M-2's cluster).
5. **Beyond the above, spec intent is well-honoured** — the DoD §11 bullet list maps to real, tested implementations. Drift is narrow, not systemic.

---

## Production-readiness assessment

**Verdict: feature-complete, NOT yet deployable.** What stands between current state and a deployable single-user install:

1. **Resolve the supply-chain exposure (M-1, High).** Clear or consciously accept the Critical protobufjs RCE and 7 High advisories. The deferred "fastify 4→5" bump alone does *not* clear the fastify advisory unless pinned `>=5.7.2`; `fast-uri` and the `@xenova/transformers→onnxruntime-web→protobufjs` chain need their own remediation. Mitigating reality: bind is `127.0.0.1`, single-user, and the protobufjs path is lazy-loaded and only reachable with a malicious model file — so *realistic* exploitability is lower than the raw "Critical" label, but the advisory is real and the status doc mischaracterises the deferred set as mere version bumps.
2. **Fix the run path (M-2, Medium).** Point `start` at `node dist/index.js` (keeping `dev` on `tsx watch`) — or correct the docs — so production deployments run the built, production-resolved artifact rather than uncompiled TS under the `development` condition. Today `backend build` emits a `dist/` no documented run-path uses.
3. **Provide a real single-command setup** to satisfy DoD §11, or amend the DoD to match the manual reality.
4. **Reconcile the deployment doc** (`auto-start.md` claims `start` runs `dist`; the systemd unit sets `NODE_ENV=production` while invoking the dev resolver).

**Not blockers but should accompany any "production-ready" claim:** the doc-currency and governance findings (M-10/M-12/M-13) — a public "production-ready" README and a stale status doc undercut the claim a reader can trust.

**Positive baseline (M-14):** the code layer itself clears the gate cleanly and the feature set is genuinely present — the remediation surface is bounded and well-understood.

---

## Findings catalog

14 reconciled findings (M-1…M-14) from the overpass (Auditor-A A-1…A-11 + Auditor-B B-1…B-8) plus Overseer depth verification. **Severity:** 1 High · 8 Medium · 4 Low · 1 Info. Full per-finding evidence on PR #133 (`RECONCILED FINDINGS` comment).

### Deployability & security
| ID | Sev | Finding | Source |
|---|---|---|---|
| **M-1** | High | Deferred dep set hides a Critical protobufjs RCE + 7 High advisories, under a "production-ready" claim; status doc calls them mere version bumps | B (Overseer-verified) |
| **M-2** | Medium | All 3 documented OS auto-start units run `tsx --conditions=development` source, not built `dist`; `auto-start.md` claims `dist`; no single-command setup | B (Overseer-verified + extended) |
| **M-3** | Low | IntelligenceView retro/stakeholder/chat require raw UUID entry (no picker) | A |

### Spec-vs-code drift
| ID | Sev | Finding | Source |
|---|---|---|---|
| **M-4** | Medium | Mermaid generation: spec-anchored v1 AI feature + orphaned Settings knob, unbuilt + undeferred | A (ruled down from A-High) |
| **M-5** | Medium | Per-session markdown export ("the shipped v1 export surface") not implemented; §7.20 deferral rests on it | A (Overseer-verified) |
| **M-6** | Low | Bootstrap `merge_fields`/`archive` deferred in code; SPEC §7.27 still lists them as available | A |

### Governance / discipline-floor codification
| ID | Sev | Finding | Source |
|---|---|---|---|
| **M-7** | Medium | Merge-method norm (AUTO_CONTINUE §D) empirically false — 6 merges/68 commits; build chain squash-merged | A+B (A High/B Med → **Med**) |
| **M-8** | Medium | Halt classes 4/5/8/9 blessed + operated in Phase E but never codified; all 6 role files delegate to a ⅓-defined set | A+B (A High/B Med → **Med**) |
| **M-9** | Medium | REQUIRED_READING §5 ("verified vs live tree") denies `experiments/`+`archive/` that its parent commit (#131) created | A+B |

### Doc currency / status accuracy
| ID | Sev | Finding | Source |
|---|---|---|---|
| **M-10** | Medium | PLATFORM_STATUS stale by an entire cohort (~15 PRs, the whole role-file suite) despite "refresh every sign-off" | B |
| **M-11** | Medium | ROADMAP & CHECKLIST stop at Phase 22; Phase E + next cohort have no sequencing/build-state home | A (open question below) |
| **M-12** | Low | README stale test counts (500/182 vs 610/204) + "production-ready end-to-end" overclaim | A+B |
| **M-13** | Low | CI-enforcement described three ways (ci.yml "advisory" / PLATFORM_STATUS "DONE" / AUTO_CONTINUE hedge); `main` is protected but doc-level contradiction stands | A+B |

### Positive baseline
| ID | Sev | Finding | Source |
|---|---|---|---|
| **M-14** | Info | Three-layer green gate verified independently 3× (610 backend / 204 frontend; both flagged flakes passed, not stress-looped) | A+B (Overseer-verified) |

**Severity-divergence rulings (recorded):** M-7 & M-8 — A graded High, B graded Medium; Overseer ruled **Medium** (dispositive governance contradictions corrupting the mental model / operational doctrine, but no functional/security/deployability impact; High reserved for those). M-4 — A graded High; Overseer ruled **Medium** (a clean cardinal-sin instance, but a single unbuilt export feature with no security/deploy impact).

---

## Audit methodology

**In scope:** the entire repo — backend, frontend, shared types, SQLite layer, methodology bundles, spec/decision docs, discipline-floor docs, role files, skills, CI, tests, handovers, plans, audits.

**Conduct:**
- **Overpass (parallel-discovery):** Auditor-A and Auditor-B independently audited the full repo from `main` @ `5d489ea`, each running a fresh `pnpm install` + the full three-layer gate, then cross-checking spec intent against code and verifying governance claims against live git history (not the docs' own prose). Findings posted as PR #133 comments (A-1…A-11, B-1…B-8).
- **Reconciliation (Overseer):** merged the two finding sets into M-1…M-14, attributing overlaps, recording the A-only/B-only split (overwhelmingly *complementary attention paths* — B ran `pnpm audit` + the deploy path; A ran spec-vs-code feature tracing + git-topology depth — not contradictions), and ruling the three severity divergences. Every dispositive claim was re-verified by the Overseer against ground truth before ruling (git topology, `pnpm audit --prod`, the start script + OS units, the source tree, the bind config, the secrets store).
- **Depth slices (Overseer-conducted):** three sub-audits were planned — (1) deployability & dependency-security, (2) spec-vs-code drift sweep, (3) governance & doc-currency — and dispatched to the auditors via the `WAKE` baton. The auditors did not pick up the slice baton; per the run's "bias strongly toward continuing autonomously / surface only if you genuinely cannot proceed" mandate, the Overseer conducted the slice depth-passes directly (reachability analysis of every advisory; the full deploy path across all three OS units; a systematic DoD §11 feature-existence walk; branch-protection / secrets / bind confirmation). A corrected ERE-regex bug during the DoD walk avoided recording false-absence findings on voice/periodic-review/command-palette/code-todo (all confirmed present on re-run).

**Out of scope / not covered:**
- **Live runtime integrations** — Anthropic / GitHub / Semble were not exercised (no live keys/network); findings depending on runtime behaviour are noted as such.
- **Flake reproduction** — both PLATFORM_STATUS-flagged flakes (`rag.test.ts`, `directives.test.tsx`) passed on each run but were not stress-looped; their flake *status* is unconfirmed, not refuted.
- **Exact branch-protection required-check list** — `main` is confirmed protected, but the precise set of required checks was not adjudicated via available tooling (M-13's doc-level contradiction stands regardless).
- **No remediation** — this is a findings run; no code or doc was changed by the audit except this summary and the Overseer's own wake-log.

**Methodology limitation (recorded honestly):** the overpass had two genuinely independent passes; the depth slices had **one** (Overseer-only) because the parallel auditors did not engage the slice cycle. The slice findings therefore carry single-auditor depth rather than the dual-independent rigour of the overpass. Mitigating this: every slice claim was verified against ground truth, and the slices largely *confirmed and refined* overpass findings rather than breaking new ground (the one substantive new item — the DoD §11 single-command-setup gap — is folded into M-2's cluster).

---

## Open questions (for human / spec-author decision)

1. **Mermaid generation (M-4):** was this meant for E17 descope and missed, or is it genuinely owed v1 work? If descoped, add a `*(deferred)*` marker to SPEC §7.21/§13 and remove the orphaned Settings knob; if owed, it needs a ROADMAP home.
2. **Per-session markdown export (M-5):** the §7.20 deferral of the larger export feature is justified by this fast-path being "shipped" — but it is not built. Build the fast-path, or re-justify the §7.20 deferral.
3. **Post-Phase-22 cohort tracking (M-11):** is the absence of Phase E / audit-fix / Phase-F-and-fastify from ROADMAP & CHECKLIST a *deliberate convention* (those cohorts tracked in PLATFORM_STATUS + handovers + execution-log instead) — in which case SESSION_START should record the convention — or genuine drift to be back-filled?
4. **Merge-method doctrine (M-7):** AUTO_CONTINUE §D's "every PR is a two-parent merge; squash not used" is false in practice (the chain squash-merged). Decide the *actual* canonical method and rewrite §D + REQUIRED_READING §7 to match reality, rather than leaving a self-disproving invariant.
5. **Halt-class codification (M-8):** halt classes 4/5/8/9 were blessed and operated but never written into AUTO_CONTINUE. Codify them (or formally retire them) so the authority floor the six role files delegate to is fully defined.
6. **CI required-check (M-13):** confirm whether `gate` is actually a required status check on `main`; reconcile the three docs to the answer.
7. **Dependency-deferral severity (M-1):** confirm the conscious acceptance of a Critical advisory in the prod tree under the current "production-ready" framing, or accelerate the fastify-v5 / dep-remediation phase ahead of any deploy.

---

*Audit conducted 2026-06-06. Overpass findings: PR #133. This summary is the audit's final deliverable; it proposes no code changes.*
