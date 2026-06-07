# Auditor-B Reviewer — pre-registered positions

*Anti-anchoring seed for the audit-role-files authoring cycle. Recorded on review branch
`claude/nice-clarke-ApQQO` **before** any draft role file is opened by the Overseer, so this
review forms its positions from the requirements, not from the author's framing.*

- **Pre-registered (UTC):** 2026-06-06T21:31:15Z
- **Baseline remote `main` HEAD:** `d5b3ed44a679763436d49073122e4fb8b362725a`
- **Reviewer:** Auditor-B Reviewer (parallel/independent of Auditor-A Reviewer; Overseer reconciles)
- **Artifacts under review (as each opens as a draft PR):** `.claude/roles/auditor-a.md`,
  `.claude/roles/auditor-b.md` (my focus), `.claude/roles/audit-overseer.md`
- **Yardstick:** the six existing role files (`.claude/roles/*.md`) as canonical pattern; the
  end-to-end audit summary (`docs/_meta/throughline/audits/2026-06-06-end-to-end-summary.md`);
  PR #133 thread (overpass findings + RECONCILED FINDINGS + slice failure comments 22/23);
  REQUIRED_READING.md; the counterpart-change-detector skill.

Each position below becomes a **Confirm** if the draft satisfies it, or a **finding** (stable
ID `B-<n>`) if it fails. IDs are stable for the life of the loop.

---

## A. Cross-cutting pattern-parity positions (all three files)

**P-1 — §1 BLOCKING required reading, abstract.** Each file opens with a BLOCKING §1 that reads
`REQUIRED_READING.md` abstractly: session-start discipline, authoring discipline, anchor system,
spec/decision records, blessed halt-class set, wake-log path + status-line token. No project
specifics hardcoded. (Parity with plan-trio §1; transportability.)

**P-2 — Standing obligations that survive compaction.** Each carries a §3-equivalent with:
verify-before-write (fresh `git ls-remote` + actual text, including SHA read-back before citing);
the finding-set-diff / set-diff gate keyed on stable IDs; one wake-log line per commit;
watcher-as-record-keeper ("detection is not awareness"); on-wake pairing; "no in-session self-wake
survives extended dormancy"; the two watcher-scoping disciplines (SELF_EXCLUDE anchored to the
*exact* branch name; re-scope on redirect).

**P-3 — counterpart-change-detector dependency.** Each names the skill by path, configures
`SELF_EXCLUDE` / `WATCH_INCLUDE` / `POLL_SECONDS`, mandates the **~25-min proactive re-arm before
the ~30-min cap**, and the on-wake pairing (diff read + comment read). Wake-channel inequality
codified: ref-moving commit wakes the watcher but is comment-blind; inline review-comment > issue-
comment; a fully-dormant/reaped session is reachable only by re-dispatch.

**P-4 — Wake-log + stable-ID finding-set-diff gate.** Each carries the wake-log (one ref-moving
line per commit, incl. `0 dropped / 0 added` no-ops; durable loop-state memory across compaction)
and the finding-set-diff gate with per-dropped-ID justification.

**P-5 — §8 convergence/termination topology invariant.** Each carries the §8 invariant, perspective-
adapted (NOT byte-identical), verified against the invariant not by byte-diff: *three independent
sign-offs · one content-SHA · green CI · overseer-executes-mechanically · execution-vs-authority ·
override window (full duration for spec-author **absence**; a **present** spec author who ratifies
collapses to zero) · named external trigger at window-expiry · ratification-classes (i)–(iv) ·
spec-author authority · non-executor roles never-merge · content-SHA binding (a content-invariant
marker does not re-stale) · authenticated-channel · inferred-authority-pending · recency-supersession ·
ratified-amendment-blocks-downstream-until-back-ported.*

**P-6 — Transportability.** Project-agnostic; travels unchanged between repos; every project
specific (paths, anchors, halt classes, merge method, override-window duration) externalized to
`REQUIRED_READING.md`. Same bar as the plan-trio.

**P-7 — Surface protocol (§7-equivalent), closed list.** Each carries a closed-list surface-to-
spec-author protocol: halt classes referred to **by category**; round-trip `X/5` escalation;
surface-substantive-actions-as-distinct-events; authenticated-channel for rulings; "pending while
awaiting a ruling, keep reviewing other threads."

**P-8 — Glossary (§9-equivalent).** Each carries a glossary for pattern parity.

---

## B. Lived-experience codification — the two production failures (load-bearing)

**P-9 — The slice-cycle baton-pass failure MUST be addressed, not silently re-codified.**
*(Highest-priority lived-experience position.)* Production fact (PR #133 comments 21/22/23): the
Overseer dispatched depth-slices via a `WAKE:` baton; Auditor-A was to open
`claude/audit-slice-1-deployability`; **it never opened**. Root cause (comment 23): Auditor-A's on-
wake comment-read polled PR-comment **page 2** (items 101+) while the WAKE landed on **page 1** —
a comment-blind miss; its ref-watcher fired on branch-moves but the paired comment-read returned
empty every cycle. Auditor-B *completed* Slice 1 but had **no shared surface** to post to, so its
work was invisible; the Overseer read "auditors silent → conduct slices solo," which was channel-
correct but work-wrong, and the dual-independence depth-pass collapsed to a single Overseer-only
pass. The three role files MUST resolve this, by one of:
  - **P-9a (fix the mechanism):** if the slice baton is retained, the slice dispatch MUST be a
    **ref-moving** signal (e.g. the slice-PR-open is itself the ref-moving event the watcher sees,
    not a comment-only `WAKE`), AND the on-wake comment-read MUST be **page-complete / newest-first**
    (the exact failure: a paged read that misses page 1). A bare issue-comment `WAKE` is precisely
    the channel the suite proved unreliable (P-3).
  - **P-9b (codify solo-overseer slices):** if the intended pattern is "audit-overseer conducts
    depth slices solo," the file MUST say so explicitly AND honestly record the methodology
    limitation (single-auditor depth vs dual-independent overpass = weaker rigor), and state when
    dual-independence must be restored vs when solo-slicing suffices.
  A file that re-codifies the baton as if it worked, with no fix and no honest limitation note, is
  a **finding** — it re-creates the exact production failure.

**P-10 — Auditor-B's hard independence rule MUST be codified MECHANICALLY, not as principle.**
*(My designated focus.)* In production the independence held by **manual discipline only**
(B kept findings durable on its own branch `claude/bold-cannon-S1V32` before reading A). `auditor-b.md`
MUST mechanize this:
  - **P-10a — write-before-read ordering.** Auditor-B performs its full independent audit pass and
    **commits its finding set to its OWN branch BEFORE reading anything on Auditor-A's PR** (A's
    comments, A's findings, the shared surface). This is stronger than plan-auditor §4.2's "form
    positions before reading the draft": it is "produce the independent finding set first."
  - **P-10b — the release point is named and mechanical.** The MOMENT independence releases is
    defined precisely: **pushing/posting B's findings to Auditor-A's PR is the release**. Before
    that push, B has not read A's findings; after it, B may read and reconcile.
  - **P-10c — gate, not exhortation.** It must read as a hard ordering gate (own-branch-commit
    precedes any read of A's PR), not "exercise independence." A "be independent" exhortation
    without the mechanical ordering is a **finding**.
  - **P-10d — auditable from git history.** The ordering must be observable: B's own-branch finding
    commit SHA/timestamp precedes B's first comment on A's PR (the wake-log makes it checkable).

**P-11 — What worked MUST be codified too.** The files should carry the overpass successes:
parallel-discovery independence (two full-repo passes yielding *complementary attention paths*, not
contradiction); **verify-don't-trust** (every dispositive claim re-verified against ground truth —
git topology, `pnpm audit --prod`, source tree — before ruling); running the **real three-layer
gate** independently (fresh `pnpm install`); the Overseer's reconciliation discipline (attribute
overlaps, record the A-only/B-only split, rule severity divergences).

---

## C. Self-consistency & audit-trio structural positions

**P-12 — Wake topology self-consistency.** All three files agree on the cyclic baton
**Auditor-A → Auditor-B → Audit-Overseer → Auditor-A**, and each file's description of the other
two matches their self-accounts (frontmatter `counterpart` / `overseer` / cross-references coherent).

**P-13 — Reconciliation model in audit-overseer.md.** `audit-overseer.md` codifies: merge two
finding sets into one reconciled set (M-N); attribute overlaps (`[A+B]`/`[A]`/`[B]`); record the
complementary-vs-contradictory split; **re-verify every dispositive claim against ground truth
before ruling**; rule severity divergences; define the severity scale (or delegate it). Drop nothing
silently; no two findings left in unrecorded conflict.

**P-14 — Findings-only; the deliverable is the summary.** All three are clear the audit proposes
**no remediation** (only the summary + wake-logs change). This shapes §8: what "converges/merges"
in a findings-only audit is the **summary's publication**, not a code change. The files must be
self-consistent about this — a §8 copied verbatim from the plan trio without adapting "merge" to
the findings-only reality is a **finding**.

**P-15 — Audit trio is structurally distinct from plan/execution trio.** The files must adapt, not
copy: BOTH auditors are content-producers (each audits independently); the Overseer reconciles +
slices + depth-verifies + authors the summary + executes. A naive copy of the plan trio's single-
producer/two-reviewer asymmetry is a **finding** where it mis-describes the audit topology.

**P-16 — Standing-re-initiator asymmetry correctly mapped.** *(Risk area.)* The plan trio's
"single planner re-initiates; reviewers stand down bounded" does NOT map directly — there is no
single producer. The files must define who re-initiates a quiet audit loop (plausibly: Auditor-A as
owner of the shared overpass PR surface; whoever opens a slice PR for slices; the Overseer is
producer-side for the summary). The mutual-stand-down-deadlock avoidance must be preserved without
mis-asserting a single planner-analogue.

**P-17 — Marker placement / branch-separated independence, adapted.** Reviewer markers off the
canonical branch; producer marker content-invariant on it. For the audit trio the "canonical branch"
is the shared overpass PR (A's branch); B's independent finding set sits on B's own branch first
(P-10), releasing to A's PR. The marker-placement mechanics must adapt coherently.

**P-18 — Audit-specific halt / surface conditions.** Each carries audit-relevant surface points:
"repo/draft unauditable" (mirror of plan-auditor §7e); **spec-drift surfaced** (a finding touching
spec the audit can't adjudicate → surface, don't invent the standard); the **coordination-gap**
(shared surface never opened / counterpart work invisible) as a recordable condition, not a silent
stall. Halt classes referred to by category only — NOT hardcoding the project's ⅓-codified set,
and NOT importing the empirically-false merge-method doctrine the audit itself found (M-7/M-8).

**P-19 — Overseer must verify auditor *engagement*, not infer it from channel silence.** Lived
failure: B completed Slice 1 but its work was invisible because no shared surface existed, and
"auditors silent" was read as "no work." `audit-overseer.md` must codify that the Overseer
**verifies engagement on the shared surface / ground truth** (and checks for durable work on
auditor branches) before declaring auditors silent or a slice unstaffed — silence on one channel is
not absence of work (the watcher-as-record-keeper / detection-is-not-awareness principle applied to
peers).

**P-20 — Methodology honesty codified.** `audit-overseer.md` must require the summary to record
coordination gaps and methodology limitations honestly (as the real summary did: "the depth slices
had one (Overseer-only) pass because the parallel auditors did not engage the slice cycle"). An
audit that hides its own coverage limitation violates the project's cardinal sin ("silent drift is
the failure").

---

## D. Highest-risk findings to watch for (derived, before reading)

- **R-1 (→P-9):** slice baton re-codified as working, no fix + no honest limitation. *High.*
- **R-2 (→P-10):** Auditor-B independence stated as principle, not mechanized write-before-read.
  *High — my designated focus.*
- **R-3 (→P-5/P-14):** §8 copied verbatim from the plan trio without adapting "merge" to findings-
  only. *Medium.*
- **R-4 (→P-16):** standing-re-initiator asymmetry mis-mapped onto a non-existent single producer.
  *Medium.*
- **R-5 (→P-6/P-18):** transportability broken by hardcoding slice mechanics or the project's
  halt/merge specifics. *Medium.*
- **R-6 (→P-12):** the three files disagree on the cyclic baton / each other's roles. *Medium.*

---

*Baseline finding-set-diff: `0 dropped / 0 added (baseline — positions pre-registered, no findings
yet)`. From the first findings commit onward the finding-set-diff runs against the prior round.*
