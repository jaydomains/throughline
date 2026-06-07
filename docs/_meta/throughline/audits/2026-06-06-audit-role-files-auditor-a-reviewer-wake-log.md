**STATUS-LINE: audit-role-files cycle — AUDITOR-A REVIEWER — files 1&2 MERGED; final — approved by auditor-a-reviewer (audit-overseer.md + REQUIRED_READING back-port, PR #138 @ 299cca5); WA-1 resolved (pending human class-(iv) ratification). All three files reviewed & signed off.**
I am the adversarial reviewer of the THREE new audit-role files the Overseer is authoring
(`auditor-a.md`, `auditor-b.md`, `audit-overseer.md`), focus on `auditor-a.md`. I run independently
and in parallel with the Auditor-B Reviewer; the Overseer reconciles our divergences. I do NOT author
the role files, I do NOT flip draft→ready, I do NOT execute the merge. Positions P-1…P-24 below are
recorded BEFORE any draft exists. Ground truth on every wake = fresh `git ls-remote` + the actual
draft text + the PR comments, never recall.

# Audit-role-files suite — Auditor-A Reviewer Wake-Log + Pre-Registered Positions

**My branch:** `claude/festive-faraday-E2riS`. **Baseline remote state @ arm time:** `main` @ `d5b3ed4`
(PR #135 just merged); the audit-role-files draft PR/branch does **not yet exist** — I watch the
`claude/*` ref-space broadly for the Overseer's first draft (likely a branch named for `auditor-a.md`).

**Reference corpus read at startup (cached, not re-read each wake):** `.claude/REQUIRED_READING.md`;
all six existing role files `.claude/roles/*.md` (plan-trio + execution-trio); the audit summary
`docs/_meta/throughline/audits/2026-06-06-end-to-end-summary.md`; PR #133's RECONCILED FINDINGS +
AUDIT PLAN: SLICES + the slice WAKE + the two slice-cycle post-mortems (B's "slice-1 PR never opened"
@ 4639284065 and A's "missed Slice-1 WAKE root-caused" @ 4640168546); the counterpart-change-detector
SKILL.md.

**Finding-ID convention (stable, never reused):** `AA-k` = finding on `auditor-a.md`;
`AB-k` = on `auditor-b.md`; `AO-k` = on `audit-overseer.md`. Residuals get `-r` suffixes
(`AA-3r`), never recycled numbers. Positions below (`P-k`) are the cross-cutting criteria each file
is measured against; a position a file fails becomes a finding under that file's prefix.

---

## The two load-bearing facts from lived audit experience (my review's spine)

1. **The slice-cycle baton-pass FAILED in production.** The Overseer dispatched Slice 1 to the
   auditors via an **issue-comment** (`WAKE: next-slice-deployability-security`) instructing
   Auditor-A to *open* `claude/audit-slice-1-deployability`. Auditor-A never saw it (its on-wake
   comment-read queried comment **page 2** while the WAKE sat on **page 1** — a comment-blind +
   pagination miss). The slice PR therefore never opened; Auditor-B completed Slice 1 but had **no
   shared surface** and could only deliver findings late on its own branch; the Overseer conducted
   all three slices **solo**, so the slices carry single-auditor depth, not the dual-independent
   rigour of the overpass. **The role files MUST resolve this explicitly** — either FIX the wake
   mechanism (slice dispatch rides a ref-move, not a comment-only WAKE) OR codify "audit-overseer
   conducts slices solo" as the intended pattern. A silent re-codification of the same comment-only
   baton that already failed is a BLOCKING finding.

2. **Auditor-B's independence held by manual discipline only.** Parallel-discovery's entire value is
   two genuinely independent passes. Nothing mechanically stopped B from anchoring to A's already-posted
   findings. The role files MUST codify B's independence **mechanically**, not as an exhortation.

---

## Pre-registered positions (verify each against the draft text + ground truth)

### Group T — Transportability & structure (pattern parity, priority 2/3)

- **P-1 · Frontmatter, ADAPTED not copied.** Each file's frontmatter (`name`, `role-family: audit`,
  `depends-on-skill`, `escalates-to: spec-author`) must fit the **audit** topology. The
  `counterpart`/`overseer`/`merge-executor`/`merge-authority` fields cannot be blind-copied from the
  plan-trio: in parallel-discovery A and B are **co-equal independent discoverers**, not
  producer↔reviewer. Verify the fields encode that (e.g. A's counterpart is B as a *parallel peer*,
  the audit-overseer reconciles; "merge-executor" only applies if the audit actually merges an
  artifact — see P-13).
- **P-2 · Transportability — grep-clean.** No baked project tokens (repo name, paths, anchor labels,
  concrete halt-class set, test/CI commands, branch-naming). All externalized to `REQUIRED_READING.md`,
  referenced abstractly. Same bar as the plan-trio.
- **P-3 · §1 BLOCKING required reading.** Points at `REQUIRED_READING.md` abstractly; additionally
  names the audit's **yardstick** — the spec/decision records + Definition-of-Done + the
  discipline-floor docs (what the audit measures the repo against). An audit with no yardstick is an
  opinion. **Watch:** `REQUIRED_READING.md §6` currently lists only the six plan/execution role files
  and does not mention the audit role files — an addressing-layer amendment is likely owed (flag if
  the suite ships without it; that amendment is itself a ratification-class change).
- **P-4 · Section skeleton parity.** §1 required-reading / §2 role-in-a-paragraph / §3 standing
  obligations (survive compaction) / §4 the loop / §5 wake-log / §6 findings+IDs / §7 surfacing /
  §8 convergence-or-termination / §9 glossary — adapted to the audit seat, not a byte-copy.

### Group I — Independence / parallel-discovery (priority 1 + 4)

- **P-5 · A forms positions independently from the repo+spec BEFORE reading the co-auditor's findings.**
  The audit analog of the auditor's pre-registered-positions anti-anchoring; here the anti-anchoring
  target is the **co-auditor's findings**, not a producer's draft. `auditor-a.md` must codify it.
- **P-6 · B's independence is MECHANICAL (the lived gap).** `auditor-b.md` must enforce — by a real
  mechanism, not exhortation — that B forms and commits its own finding set BEFORE reading A's
  findings (e.g. B audits on its own branch, commits its findings file, and does **not** fetch/read
  the shared PR's existing A-comments until its own set is committed; or both open at the same anchor
  SHA and neither reads peer comments until posted). Verify the mechanism is actually load-bearing.
- **P-7 · Symmetric co-equal topology — no mis-transplanted producer/reviewer asymmetry.** A and B run
  in parallel; neither is the other's "standing re-initiator" and there is no producer→reviewer
  "bounded stand-down between rounds" *between A and B*. Verify the files don't import the
  planner↔auditor re-initiation asymmetry where it doesn't belong. (The auditor↔overseer relationship
  may still carry a dormancy/stand-down posture — verify it's correctly scoped.)
- **P-8 · Self-consistent wake topology.** Whatever baton/wake order the files describe
  (the brief names Auditor-A → Auditor-B → Audit-Overseer → Auditor-A) must be **internally
  consistent across all three files** and must match the actual parallel-discovery audit (A+B parallel,
  Overseer reconciles). No file may say "auditors run X in parallel" while another says "overseer runs
  X solo." Verify against the audit summary's described conduct.

### Group S — Slice cycle / baton-pass failure (priority 1 — load-bearing)

- **P-9 · Explicit resolution of the slice baton-pass failure.** The files MUST make a deliberate,
  named choice: (a) fix the wake mechanism, or (b) codify "audit-overseer conducts slices solo."
  Silence here = BLOCKING finding.
- **P-10 · If (a): the fix is mechanical and names the root cause.** Slice dispatch must ride a
  **ref-move** (the audit-overseer opens the slice branch/PR itself — a branch-create the ref-watcher
  catches) rather than a comment-only WAKE; AND/OR the auditors' on-wake comment-read is specified as
  full / newest-first / all-pages (the exact page-2 miss). This must connect to the existing canonical
  discipline that **issue-comments fail to wake / prefer ref-moving or inline** — the slice WAKE was
  precisely that failure mode.
- **P-11 · If (b): solo-slice conduct is owned by `audit-overseer.md` and its honesty limit is stated.**
  The methodology limitation (slices carry single-auditor depth vs the overpass's dual-independent
  rigour) must be acknowledged as a known property, not hidden.
- **P-12 · Cross-file consistency on the slice model.** All three files agree on whichever choice.

### Group P — Pattern-parity disciplines (priority 2)

- **P-13 · §8-equivalent: the audit's REAL termination model, not a blind merge-gate transplant.**
  An audit is **findings-only, no remediation**. The audit PR (#133) was a *working coordination
  surface* — empty anchor commit, findings as comments — and was **CLOSED, not merged**; the
  **summary** is the deliverable. So the audit-overseer is NOT a "three-sign-off merge-executor" of
  the audit PR in the plan-overseer sense. Verify `audit-overseer.md` codifies a **termination
  criterion** ("the audit is complete when the slices answer 'where is the project' comprehensively
  enough to author the summary honestly") rather than a three-sign-off-+-CI-+-override-window merge
  gate. IF the summary itself goes through a review/merge, verify that path is described and
  consistent. A wholesale copy of plan-overseer §8 onto an audit that has nothing to merge is a major
  finding.
- **P-14 · Verify-before-write / ground-truth-not-prose.** Ground truth = fresh `git ls-remote` +
  actual repo read + **the actual gate run** (fresh install + full three-layer gate) +
  **live git history**, NEVER the repo's own prose claims. This is the overpass's signature: governance
  claims verified against live git topology not the docs, "production-ready" verified by running the
  gate. Cite-SHA-after-reading. Never author-and-assert-verification in one action.
- **P-15 · Watcher-as-record-keeper / detection-is-not-awareness.** Re-arm proactively ~25-min before
  the ~30-min cap (canonical); watcher is a record-keeper not a notifier; read watcher-log + fresh
  `git ls-remote` every wake; on-wake pairing = diff + read comments; `SELF_EXCLUDE` = **exact** branch
  name; cross-PR redirect-rescope.
- **P-16 · Wake-log discipline.** One line per event; a ref-moving commit accompanies every action
  (comment-only never wakes); records last-seen remote HEAD + finding-set-diff + per-thread counts;
  durable loop-state memory across compaction.
- **P-17 · Stable finding IDs + finding-set-diff gate.** Audit used `A-k`/`B-k`; the reconciliation
  consumed them into `M-k`. Verify the files carry stable-ID + set-diff discipline (dropped IDs carry
  a one-line justification) so "did a finding fall through the cracks" is checkable from history.
- **P-18 · Standing obligations survive compaction; reconstruct loop state from the wake-log on resume.**
- **P-19 · Persistence / authority disciplines, ADAPTED.** Authenticated-channel, inferred-authority,
  ruling-supersession, back-port-blocking — carry where they apply. For a findings-run some have less
  surface (no code/spec change to merge → little class-(i)/(ii) ratification), but the **summary's
  status claim** (e.g. flipping "production-ready" → "feature-complete, not deployable") is a durable
  status-doc assertion that may itself be ratification-class. Verify thoughtful adaptation, not
  copy-paste of merge-centric clauses that don't fit.

### Group H — Halt conditions & surface protocols (priority 5)

- **P-20 · Halt classes by CATEGORY only.** Never reproduce/rename the project's halt-class labels;
  point at `REQUIRED_READING.md §4`. Do NOT hardcode a count — the blessed set is known to be only
  ⅓-codified (M-8); an auditor hitting a blessed-but-uncodified extension should surface it.
- **P-21 · Surface-list adapted to the audit seat (closed list).** e.g. (a) spec/requirements ambiguity
  that blocks adjudicating a finding; (b) anchor-system conflict; (c) blessed halt-class condition;
  (d) an A↔B **severity/finding divergence** that can't be reconciled (the audit analog of round-trip
  escalation — the Overseer ruled the A-High/B-Med splits; verify an escalation path exists);
  (e) the repo is **unauditable** / the gate cannot be run. Verify what goes to human vs to other
  sessions.
- **P-22 · Finding ≠ halt.** An auditor's JOB is to find problems, so discovering a Critical bug is a
  **normal finding**, not a halt. A halt is a sanctioned condition in the auditor's **own conduct**
  (spec drift it cannot adjudicate, circuit-breaker, explicit pause). Verify the files don't conflate
  "I found something bad in the repo" with "I must halt."

### Group C — Audit-conduct fidelity (lived experience, priority 1)

- **P-23 · Overpass conduct codified + findings-only / no-remediation.** Independent full-repo pass;
  fresh install + full three-layer gate; spec-intent-vs-code tracing; governance-claims-vs-live-git.
  The audit changes **no code/doc** except the summary + wake-logs — an auditor that "fixes" what it
  finds has left its lane. Verify both.
- **P-24 · Absence-finding rigor (the ERE-regex lesson) + reconciliation discipline.** "X is
  missing/unbuilt" findings get extra verification rigor (the Overseer's first-pass regex nearly
  recorded false-absence on voice/periodic-review/etc.; a corrected search refuted them). And
  `audit-overseer.md` must codify the reconciliation: unify A+B into one catalog, attribute overlaps,
  record A-only/B-only as **complementary attention paths vs contradiction**, re-verify every
  dispositive claim against ground truth before ruling, and rule severity divergences against a
  stated scale.

---

## Round log (one line per wake/action)

- **2026-06-06 — baseline.** Positions P-1…P-24 pre-registered BEFORE any draft (anti-anchoring).
  Last-seen remote HEAD: `main` @ `d5b3ed4`; no audit-role-files draft PR/branch exists. Watcher to be
  armed on the `claude/*` ref-space (broad arm + manual `git ls-remote` scan at arm time;
  `SELF_EXCLUDE` = `claude/festive-faraday-E2riS`). Finding-set-diff: `0 dropped / 0 added (baseline —
  positions pre-registered, no findings yet)`. Standing by for the Overseer's first draft PR.

- **2026-06-06 — wake: Overseer opened PR #136 (`auditor-a.md`).** Watcher (`burh0eebz`) logged REF on
  `claude/nice-clarke-ApQQO` (= Auditor-B Reviewer) and `claude/tender-hypatia-pvPkP` (= Overseer
  draft). Last-seen remote HEAD: PR #136 @ `1cb2a6d` (branch `claude/tender-hypatia-pvPkP`, base
  `origin/main` @ `d5b3ed4`). Read draft `auditor-a.md` (565 lines) **independently** — did NOT read
  the Auditor-B Reviewer's findings (parallel-independence). Verified each position against ground
  truth: re-diffed against `origin/main` (corrected a stale local `main` @ `4c1ab1b`); confirmed
  REQUIRED_READING §6 still lists only the six plan/exec files; confirmed `claude/audit-overpass`
  still on remote. **Posted COMMENT review** on PR #136 bound to `1cb2a6d`: findings **AA-1** (Missing,
  Med — REQUIRED_READING not amended, re-creates M-9), **AA-2** (Refine, Low — "610 tests" token),
  **AA-3** (Refine, Low — default branch-name collision), **AA-4** (Refine, Low-Med, cross-file —
  overpass single-surface dependency); + Confirms AA-C1…AA-C6 (topology/slice-fix/ground-truth/
  absence-lesson/watcher/authority all verified-good). Finding-set-diff: `0 dropped / 4 added
  [AA-1, AA-2, AA-3, AA-4]`. Per-thread round-trips: AA-1…AA-4 each `1/5`. **NOT signed off** — holding
  final-marker pending AA-1 resolution-or-tracking. Re-arming watcher; standing by for the Overseer's
  revision/response (I do not re-initiate; the author drives).

- **2026-06-06 — wake: Overseer revised + responded (round 2).** Watcher logged `tender-hypatia`
  moves `1cb2a6d → 8bc57a2 → 648b34a → dd5c92e`. Read PR #136 thread to the tail (now safe — my
  independent review already posted): the Auditor-B Reviewer posted B-A1/B-A2/B-A3 + Confirms and
  **FINAL-approved @ `8bc57a2`**; the Author folded B-A1 (authority-softening) + B-A2 (branch-name)
  @ `8bc57a2`, then folded my **AA-2** (`610`→`N tests`) @ `dd5c92e`. Re-verified ALL my findings
  against ground truth at `dd5c92e` (not the author's word): `8bc57a2..dd5c92e` is *exactly* the AA-2
  edit, no regression. Disposition — **AA-2 RESOLVED** (`N tests` present, `610` absent); **AA-3
  RESOLVED** (no `claude/audit-overpass` literal; folded round 1 via B-A2 — my collision catch
  corroborated it); **AA-1 DROPPED as blocker on this file** (file handles REQUIRED_READING silence
  gracefully via default-and-note; the §6/§7 back-port is durably **tracked** to the audit-overseer.md
  (file-3) cycle for human ratification — same item as B-A3) → **carried as forward watch WA-1**:
  verify the REQUIRED_READING amendment actually lands + gets class-(iv) human ratification in file 3;
  I do **not** rest this sign-off on the *relayed* routing ruling (pending-not-actionable per the
  file's own §8 authenticated-channel discipline), only on the durable tracking; **AA-4** never a
  defect in this file → **carried as cross-file watch WA-2**: verify auditor-b.md codifies the
  symmetric overpass-level fallback (B opens/keeps own findings branch + surfaces to overseer if A's
  PR absent). B-A1/B-A2 folds (which I had not independently reviewed) both *align with* my positions
  (authority-softening strengthens AA-C6; branch-fix = AA-3). Confirms AA-C1…AA-C6 all still hold at
  `dd5c92e`. **POSTED FINAL-MARKER + approval** bound to content-SHA `dd5c92e`. Finding-set-diff:
  `4 dropped [AA-1, AA-2, AA-3, AA-4] / 0 added` (each justified above); open forward watches WA-1, WA-2.
  Per-thread round-trips: AA-1…AA-4 each `2/5` (resolved). My marker re-stales on any content-changing
  push to auditor-a.md; a wake-log-only push does not. Convergence needs all three markers at one
  content-SHA + spec-author class-(iv) ratification; the Overseer executes — not me. **Note for the
  Overseer:** the Auditor-B Reviewer's marker (bound to `8bc57a2`) re-staled when `dd5c92e` changed
  content (the AA-2 fold) — B needs to re-approve at `dd5c92e` for convergence. Re-arming; standing by
  for B's re-approval / the Author's marker / the next draft (auditor-b.md or audit-overseer.md).

- **2026-06-06 — wake: #136 MERGED + #137 (auditor-b.md) opened.** Verified from ground truth: `main`
  advanced `d5b3ed4 → b5e0769`; `auditor-a.md` is on `main`, **byte-identical to the `dd5c92e` I
  approved** (no post-approval drift — my sign-off honored). My `auditor-a.md` review is terminally
  done. `REQUIRED_READING.md` still unamended on `main` → **WA-1 correctly pending file-3**. PR #137
  `auditor-b.md` (551 lines) opened @ `3622b6f` (same branch `claude/tender-hypatia-pvPkP`, base
  `b5e0769`); changes only auditor-b.md + its wake-log. Reviewed **independently** (did NOT read the
  Auditor-B Reviewer's #137 findings). Verified vs P-1…P-24, WA-1/WA-2, and the merged auditor-a.md.
  Disposition: **WA-2 RESOLVED** — §4.6 codifies the overpass fallback (A's PR absent → B opens own
  branch + surfaces to overseer) = my AA-4 closed. Posted **findings AB-1** (Refine, Low-Med —
  "auditable from git history" over-claims the *read* boundary; git proves commit-before-*publish*,
  not before-*read*; the §3.2 self-attestation is the right backstop; directly answers B's W-1) and
  **AB-2** (Refine, Low — §4.4 vs §4.7 cross-ref for "drive the wait"); + Confirms AB-C1…AB-C5
  (mechanical-independence design sound, WA-2 resolved, W-4 frontmatter consistent, transportability
  clean, shared disciplines carried). Finding-set-diff: `0 dropped / 2 added [AB-1, AB-2]`. Per-thread
  AB-1/AB-2 each `1/5`. **NOT signed off** — holding final-marker pending AB-1 (author tightening).
  Forward watch **WA-1** carried to file-3. Watcher live; standing by for the Author's #137
  revision/response (I do not re-initiate; the author drives).

- **2026-06-06 — wake: Author folded AB-1/AB-2 (#137 @ b38b1da); FINAL-approved.** Verified from
  ground truth: `git diff 3622b6f..b38b1da` is *exactly* the AB-1 four-site tightening + AB-2
  cross-ref, no regression. **AB-1 RESOLVED** — frontmatter/§3.2/§4.3/glossary now distinguish
  git-auditable *commit-before-publish* from attested *no-peek-before-commit* ("a read leaves no git
  trace"), backstopped by the obl-2 self-attestation — exactly the precision I asked for; grep
  confirms no bare "auditable from git history" overclaim remains. **AB-2 RESOLVED** — obl 6 now
  "(§4.7; PR-open detection at §4.4)". Confirms AB-C1…AB-C5 still hold (the fold *strengthens* AB-C1).
  Cross-validation: the Auditor-B Reviewer independently raised the same precision as **B-B1** — two
  blind reviewers converging (parallel-discovery validating itself); B FINAL-approved @ `b38b1da`.
  Out-of-lane (noted, not my findings): Gitar flagged a "PR #2"→#137 typo in the *author's* wake-log
  (not auditor-b.md content); a `gatesView.test.tsx:88` flake on the author's branch (re-triggered
  green; CI-green is the Overseer's execution-time re-confirm, not my content gate). **POSTED
  FINAL-MARKER + approval** bound to content-SHA `b38b1da`. Finding-set-diff: `2 dropped [AB-1, AB-2]
  / 0 added` (both justified). Per-thread AB-1/AB-2 each `2/5` (resolved). My marker re-stales on any
  content-changing push to auditor-b.md; a wake-log-only push does not. Convergence for #137 needs:
  my marker (in) + B's re-verified marker (in @ b38b1da) + the Author's marker, all at `b38b1da`, +
  green CI + spec-author class-(iv) ratification; the Overseer executes. Forward watch **WA-1**
  carried to file-3 (audit-overseer.md), with B's **W-2** (overseer verifies engagement before
  declaring silence; how the summary lands on main) and **W-3** (bound delegated-authority). Watcher
  live; standing by for the third draft, audit-overseer.md (I do not re-initiate; the author drives).

- **2026-06-07 — wake: #137 MERGED; #138 (audit-overseer.md + REQUIRED_READING back-port) opened &
  reviewed.** Verified from ground truth: `auditor-b.md` is on `main` (`fd39434`) → **#137 merged**.
  PR #138 opened (file 3 of 3, capstone) — TWO artifacts: `audit-overseer.md` (471 lines) + the
  `REQUIRED_READING.md` audit-trio back-port (WA-1), which **amends the BLOCKING addressing layer**.
  Read both **independently** (did NOT read the Auditor-B Reviewer's #138 findings). Verified the RR
  back-port **accurate against the live tree** (all 9 role files exist → "nine roles" true → the M-9
  trap is *closed*; audit-file path correct; dormant-bound consistent). Found **AO-1** (Refine,
  Low-Med): RR named `claude/audit-overpass` as the default audit-branch, but that ref still exists
  on the remote (`ad898d0`, PR #133) → collision; it undid the AA-3/B-A2 fix by indirection (since
  auditor-a.md §4.5 delegates the branch name to RR). On re-fetch the head had advanced `7d31ef8 →
  299cca5`: the author had **already folded the Auditor-B Reviewer's B-O1/B-O2**, and **B-O1 ≡ my
  AO-1** (third two-blind-reviewers-converge in this suite). **AO-1 RESOLVED at 299cca5** (verified):
  branch convention now `claude/audit-overpass-YYYY-MM-DD` (collision-free by construction) + explicit
  stale-leftover note (`claude/audit-overpass`, `claude/bold-cannon-S1V32`). W-2 (engagement-before-
  silence §4.5/§3.6; summary methodology-honesty §4.6; **summary lands via human ratification, not
  single-party self-merge** §4.8; findings-PR closed-not-merged), W-3 (bounded delegated authority
  §3.7/§7/§8 + authenticated-channel governs the overseer's own delegation), and the reconciliation/
  **verify-don't-trust**/drop-nothing/severity-divergence discipline (§6) all carried and strong.
  Transportability clean (2026-06-06 refs illustrative, marked). **WA-1 RESOLVED** (amendment present,
  accurate, correctly routed for human class-(iv) ratification). **POSTED FINAL-MARKER + approval**
  bound to content-SHA `299cca5`. Finding-set-diff: `1 dropped [AO-1, resolved-via-B-O1-fold] /
  0 added`. CI status at head = pending/0-checks (the Overseer's execution-time green-gate concern,
  not my content lane). Convergence for #138 needs: my marker (in) + B's marker + the Author's marker
  at one content-SHA + **green CI + explicit human class-(iv) ratification** (BLOCKING-layer amendment
  + new-topology precedent); the Overseer executes. **All three audit-trio files now reviewed &
  signed off by me.** Watcher live; standing by for any content-changing re-push (would re-stale) /
  the human ratification / merge of #138.
