# plan-auditor.md — Peer Audit (Auditor) Wake-Log + Pre-Registered Positions

**STATUS-LINE / FINAL-MARKER: AUDITOR — APPROVED (re-signed) @ `c2a4acb0` (PR #121).** OV-2 folded
(§6 now carries the bootstrap-baseline clause, mirroring planner.md A-6) + B-1 micro-nit folded
("Three things…"); §8 verified BYTE-IDENTICAL across the fold (no drift); transportability clean; no
regression. All PA-1…PA-8 now genuinely satisfied (PA-7 parity complete). OV-1/B-1 (§8 drift-risk)
non-blocking, surfaced. Marker bound to `c2a4acb0` — stale + re-verify if the file changes. I do NOT
merge / flip draft→ready. Convergence on planner + overseer markers also at `c2a4acb0` → auto-merge
(normal class) after override window.


*Cycle 2 of 6 (planner ✅ merged #119 @ `7d76b7c`). I am the **plan-auditor** peer to the planner,
authoring-cycle for `plan-auditor.md`. Same three-party cycle; autonomous merge via plan-overseer per
the #119 topology amendment. planner.md (on main, 500 lines) is the precedent shape.*

*Positions below are pre-registered BEFORE the planner's draft (anti-anchoring). This file is my durable
loop-state across compaction — reconstruct from here + PR threads, never working-context recall.*

---

## Run context (ground truth)
- #119 MERGED: main `2330be3`→`7d76b7c` ("planner role prompt + overseer-executes-merge amendment");
  planner.md branch deleted. The overseer auto-merge (ratification path) worked end-to-end.
- My auditor branch: `claude/planner-role-audit-FuAh9` (durable wake-log home; SELF_EXCLUDE target).
- plan-auditor.md branch: does NOT exist yet — planner to push first commit shortly (new branch).
- Precedent: `.claude/roles/planner.md` @ `7d76b7c` (the shape plan-auditor.md mirrors).

## Standing obligations (anchored — survive compaction)
1. Counterpart loop via `.claude/skills/counterpart-change-detector/`. Watch the PLANNER's new branch
   (+ overseer ref space, per the F8 lesson — don't scope so narrow I miss the overseer's sign-off).
2. On every wake: `git ls-remote` ground truth → fetch+diff moved refs → READ PR comments (watcher is
   comment-blind). Verify before writing any claim.
3. On every Monitor stop/timeout: re-arm, fresh baseline, arm-time manual scan. No in-session self-wake
   survives dormancy → reviewer-side §4.9 BOUNDED stand-down between rounds; **the PLANNER re-initiates,
   not me.**
4. Filter own echoes (`SELF_EXCLUDE`=my branch). Audit independently FIRST. Peer, not subordinate.
5. I do NOT author/revise plan-auditor.md (planner folds). I do NOT merge / flip draft→ready (overseer's,
   post-ratification/override-window). I do NOT converge on the planner's behalf.

---

## Pre-registered positions — what `plan-auditor.md` MUST contain
*(Formed from the planner.md precedent + the auditor-role requirements, BEFORE reading the draft.)*

### PA-1 Transportability
Grep-clean (`throughline|sitemesh|agent_dashboard|T-D#|C-D#|AZ-D|HB-D|MI-D|docs/_meta|.claude-code|
.throughline|gitar|jaydomains|PLATFORM_STATUS|AUTO_CONTINUE|SESSION_START|AUTHORING_DISCIPLINE`). All
project specifics via REQUIRED_READING. Merge-governance *posture* externalized; convergence *topology*
baked — the A-2r baked-topology-vs-externalized-posture boundary planner.md established.

### PA-2 Skill invocation
Invoke counterpart-change-detector by path (not restated); re-arm obligation anchored in the role prompt
(compaction-survival §); on-wake comment-read pairing (watcher comment-blind). Watch the PLANNER's branch
for revisions AND cover the overseer's ref space (F8: don't scope so narrow the overseer's activity is
filtered/missed). `SELF_EXCLUDE`=auditor's own branch.

### PA-3 Required-reading
Points at project REQUIRED_READING.md; categories not filenames.

### PA-4 Auditor-specific role shape (the heart — what DIFFERS from planner)
- **Reviewer, not author:** receives the planner's draft PR, audits it, posts findings; does NOT
  author/revise the plan — the planner folds.
- **Independent-first (load-bearing):** form own positions on what the plan should contain BEFORE reading
  the planner's draft framing (anti-anchoring) — pre-register, timestamped. This is THE auditor discipline;
  if the file omits or weakens it, that's a finding.
- **Verify-before-write:** verify each finding against the actual code/plan before posting; never a claim +
  its verification in one step; re-verify on every wake (a prior verification doesn't carry forward).
- **The auditor ASSIGNS the stable finding IDs** that are authoritative for the planner's set-diff gate
  (mirror planner.md §6). The auditor's posted ID set defines coverage; the planner can't redefine it.
- **Finding taxonomy:** Confirm / Push-back / Refine / Missing, severity-classified.
- **Defend-or-fold:** under the planner's push-back, defend with stronger evidence or fold — explicitly.
- **Wake-log:** the auditor commits a wake-log line per action so its ref-moving activity wakes the planner
  (mirror planner §5; the comment-blind rationale applies symmetrically).
- **Final-marker + approval** on convergence; bound to SHA; stale if the file changes → re-verify+refresh.

### PA-5 Reviewer-side dormancy / stand-down
- Reviewer-side ⇒ §4.9 BOUNDED stand-down between rounds; **the planner is the standing re-initiator, NOT
  the auditor** (the mutual-stand-down-deadlock avoidance — the file must NOT make the auditor re-initiate).
- Dormancy honesty: no purely in-session self-wake survives extended dormancy; push latency-only.
- Compaction: reconstruct loop-state (open threads, X/5, last-seen HEAD) from the wake-log.

### PA-6 Convergence & merge topology (mirror planner.md §8, post-amendment)
- Convergence = three independent sign-offs (planner + auditor + overseer) at ONE SHA + green CI.
- "Two things you may never do" (auditor): never flip draft→ready, never execute the merge — both the
  overseer's (merge mechanical, after gate + override window + external trigger; ratification scope-classes
  after spec-author ratification). The auditor's final-marker is one of the three.
- merge-executor = plan-overseer; merge-authority = spec-author (override window + ratification classes).

### PA-7 Shape consistency with planner.md (precedent)
- frontmatter mirrors planner: `name: plan-auditor`, `role-family: plan`, `counterpart: planner`,
  `overseer: plan-overseer`, `escalates-to: spec-author`, `merge-executor: plan-overseer`,
  `depends-on-skill: …`. §1–§9 structure mirrors planner.md. Location `.claude/roles/plan-auditor.md`
  (flat sibling). Shared disciplines identical; only the role-differentiated parts (PA-4/PA-5) change.

### PA-8 Missing / degraded paths (auditor-specific)
- Auditor disagrees with a claimed fold (planner says resolved, it isn't) → re-open with evidence
  (verify-before-write catches it); the planner's claim is not self-certifying.
- **Planner (the re-initiator) goes silent** → the auditor does NOT take over re-initiation (asymmetric
  model); reviewer-side bounded stand-down; loop resumes on the planner / external trigger.
- Unresolvable auditor↔planner disagreement at **5/5 round-trips** → escalate to the spec author (mirror
  planner §7); the auditor escalates, does not unilaterally win or fold.
- Stale-marker: auditor sign-off bound to SHA; planner revision → stale → re-verify + refresh.

---

## Wake-log (chronological)
- **2026-06-03 (cycle-2 arm)** — #119 merged; planner.md precedent on main @ `7d76b7c`. Positions
  PA-1..PA-8 pre-registered (above) before the planner's plan-auditor.md draft. Arming detector (broad,
  scoped to role/plan/auditor/overseer/executor refs; existing branches baselined). Awaiting the planner's
  first plan-auditor.md commit. I am reviewer-side; planner re-initiates.

- **2026-06-03 (round 1 + SIGN-OFF — draft @ 4ca872db, PR #121)** — On-wake pairing: fetched+diffed
  the draft + read PR #121 body. Verified independently against the text (positions pre-registered at
  edbe93f BEFORE reading). Result: **PA-1..PA-8 ALL satisfied.** PA-1 transportability grep 0 matches;
  PA-2 skill invoked by path + re-arm anchored (obl 5) + on-wake pairing + watches planner AND overseer
  (F8 applied); PA-3 required-reading categories; PA-4 auditor-specifics all sharp (independent-first
  obl 2/§4.2, verify-before-write obl 1, §6 producer-side stable IDs, taxonomy, defend-or-fold §4.6,
  "never rubber-stamp"); PA-5 reviewer-side asymmetry correctly inverted (auditor stands down, planner
  re-initiates, obl 8/§4.9); PA-6/§8 diffed vs planner.md @ 7d76b7c — **NO topology drift** (only
  perspective + obligation cross-ref 7→8 + condensation); PA-7 frontmatter/structure mirror; PA-8
  degraded paths (planner-silence asymmetry §7, 5/5→spec-author §7d, unreviewable-draft §7e, stale-marker
  §4.7/§8). **One finding: B-1 (LOW, Refine, NON-BLOCKING, suite-level)** — §8 is per-perspective not
  byte-identical (PR's "byte-faithful" claim imprecise); verified no drift here, but cycles 3-6 need a
  §8-topology-invariant checklist (not byte-diff) to drift-check. Micro-nit: "Two things you may never
  do" lists three. **SIGNED OFF** (this commit = final-marker; approval comment posted). Set-diff:
  `0 dropped / 1 added [B-1]`. Marker bound to `4ca872db`. Reviewer-side §4.9 bounded stand-down between
  rounds; planner re-initiates. Convergence on overseer + planner markers at one SHA → auto-merge after
  override window (normal class — not §8.3 ratification).

- **2026-06-03 (sign-off CORRECTION — overseer cross-check)** — Overseer review (4615613178) cross-checked:
  its C-1 = my PA-6 (§8 no drift); **OV-1 ≈ my B-1** (§8 six-way duplication/drift-risk, non-blocking) →
  merged B-1 into OV-1 (overseer's CI-conformance-check fix is stronger); **OV-2 (blocking) — §6 omits the
  bootstrap-baseline clause planner.md §6 has — VALID, and I MISSED it** (verified: planner §6 has it,
  plan-auditor §6 lacks it, obligation 3 makes the gate mandatory→undefined at the §4.2 positions commit;
  it's the mirror of my own A-6). Folded (defend-or-fold). **WITHDREW my unconditional sign-off** →
  conditional on OV-2 fold (overseer also withholding on OV-2). Posted 4615639071. Net open: OV-2 (blocking,
  quick), OV-1/B-1 (non-blocking suite-infra). On planner's OV-2 fold → re-verify §6 + §8 + re-sign.
  Set-diff: `1 dropped [B-1→OV-1] / 0 added`. CI green at 4ca872db. send_later unavailable → rely on
  monitor + #121 push subscription; reviewer-side §4.9 bounded stand-down; planner re-initiates.

- **2026-06-03 (re-verify OV-2 fold — author @ c2a4acb0) — AUDITOR RE-SIGN.** Planner folded
  `4ca872db`→`c2a4acb0` ("Fold round-1: OV-2 (§6 bootstrap baseline) + B-1 micro-nit"). Verified vs text:
  §6 now has the bootstrap-baseline clause (§4.2 positions commit = gate baseline, `0/0 (baseline)`,
  gate diffs from first findings commit onward) — **OV-2 RESOLVED** (mirrors planner.md A-6); "Three
  things you may never do" — **B-1 micro-nit folded**; **§8 BYTE-IDENTICAL** across the fold (diff empty
  — no drift); transportability grep clean; diff localized to §top+§6 (no regression). All PA-1..PA-8 now
  genuinely satisfied. **RE-SIGNED** @ `c2a4acb0` (this commit = refreshed final-marker + approval comment).
  Set-diff: `0 dropped / 0 added`. Supersedes withdrawn `22dbebb`@`4ca872db`. Convergence on planner +
  overseer markers also at `c2a4acb0`; overseer re-verifies its OV-2 fold + re-signs. Reviewer-side §4.9
  bounded stand-down; planner re-initiates. (Gitar ✅ webhooks = no-ops; CI green.)

- **2026-06-03 (3-PARTY CONVERGENCE COMPLETE @ c2a4acb0)** — Planner posted its final-marker `d2f8271`
  (wake-log only; plan-auditor.md UNCHANGED → my fbc18eb + overseer ba9d783 markers stay valid). All
  three signed at `c2a4acb0` content: planner d2f8271 · auditor fbc18eb · overseer ba9d783. **Normal
  auto-merge class** (not §8.3 ratification) → overseer auto-merges after the override window (planner =
  standing re-initiator re-triggers at window-expiry per §8.2). main `7d76b7c` (NOT merged yet); branch
  present. Gitar webhooks = no-ops (CI green). **ON MERGE:** verify via `git ls-remote` (main advanced /
  branch deleted) → terminal stand-down (§4.8): unsubscribe #121, stop monitor → **re-arm for cycle 3
  (plan-overseer.md)** with fresh pre-registered positions. OV-1/B-1 (§8 six-way drift-risk) carried
  forward as non-blocking suite item to watch in cycles 3-6. I do NOT merge / flip draft→ready.

- **2026-06-03 (reviewer-side §4.9 bounded stand-down through override window)** — Overseer confirmed
  CONVERGENCE REACHED (f83d8ff), holding the merge pending the override window. Cycle-2 work complete
  (re-signed @ c2a4acb0). Stopped the monitor poll (TaskStop bjzcx20ni) — the poll is a poor merge
  detector anyway (branch-deletion invisible to comm -13; main not in WATCH_INCLUDE). **Relying on the
  #121 push subscription** (a merge is a definite PR event push delivers) **+ re-dispatch** as the
  merge-trigger. ON MERGE (push/re-dispatch): `git ls-remote` confirm (main advanced / branch deleted)
  → terminal stand-down (unsubscribe #121) → **re-arm for cycle 3 (plan-overseer.md)** with fresh
  pre-registered positions; carry OV-1/B-1 §8-drift-risk watch forward. Not merged yet (main 7d76b7c).

- **2026-06-03 (CYCLE 2 COMPLETE — #121 MERGED)** — Verified via git ls-remote: main `7d76b7c`->`f895b07` ("Add plan-auditor role prompt (second of six) (#121)"); plan-auditor.md now on main alongside planner.md. Override window was compressed; overseer auto-merged; #121 push auto-unsubscribed. Cycle-2 terminal: no watcher-stop (continuing to cycle 3). **Transition to cycle 3 (plan-overseer.md)** — monitor b6ooer5nm armed (watches main + plan-overseer + overseer); positions pre-registered in the cycle-3 wake-log.
