# Throughline — Required Reading

*The project-specific addressing-and-parameters layer for the role files at
`.claude/roles/`. Each role file's §1 is **BLOCKING** on this document.*

---

## How to use this file

**Read this once on session startup, then cache it — do not re-read it on every
wake.** This file is pointers and parameters, not content. It is the addressing layer
that tells a role-file session *where* the project's truth lives and *what* this
project's tunable parameters are; the truth itself stays in the documents pointed to,
so that a doc moving or changing requires updating **only this file**, not the six
project-agnostic role prompts.

Re-reading the addressing layer on every wake burns context for no gain: the pointers
do not change mid-loop. Read it at startup, hold the pointers, and on each wake spend
your reads on ground truth (`git ls-remote`, the diff, the PR comments) — not on
re-parsing this map.

Nothing here overrides the documents it points at. Where this file states a **parameter
value** (§7), that value *is* the project's setting — the role files explicitly delegate
those parameters here.

---

## 1. Startup discipline docs

Read these on startup, in this order (the order is owned by `SESSION_START.md`):

| Doc | Path | Owns |
|---|---|---|
| Session start | `SESSION_START.md` *(repo root)* | The discipline floor: what to read, in what order, branch/plan/PR/anchor/spec-drift policy. **Read first.** |
| Platform status | `docs/_meta/throughline/PLATFORM_STATUS.md` | Living current-state snapshot. Mutable; refreshed every session sign-off. |
| Auto-continue workflow | `docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` | Slice-chain rhythm, the three-layer green gate, the halt classes (§4 below). |
| Authoring discipline | `docs/_meta/throughline/AUTHORING_DISCIPLINE.md` | Status taxonomy (`spec-anchored` → `pre-work-doc-complete` → `feature-complete` → `production-ready`) and the pre-work / post-work doc gates. |

`SESSION_START.md`'s reading order for a new build session:
**SESSION_START → PLATFORM_STATUS → most recent handover → SPEC → CODE_SPEC →
ROADMAP → CHECKLIST → DECISIONS** (DECISIONS consulted as needed, not read end-to-end).

---

## 2. Spec & decision records

All at the **repo root** — this is a flat, single-spec project (no per-module spec or
decision files):

| Record | Path | Owns |
|---|---|---|
| Functional spec | `SPEC.md` | *What* Throughline does and *why*. §14 is the T-D decision index. |
| Implementation spec | `CODE_SPEC.md` | *How* it is built. Carries the C-D anchors inline. |
| Decisions | `DECISIONS.md` | Full body of every T-D anchor (date, status, sections, decision, context, rationale, implications). |
| Roadmap | `ROADMAP.md` | Phase order, dependencies, parallelism. |
| Checklist | `CHECKLIST.md` | Build state — what is built, in flight, outstanding. |

A plan/change's **yardstick** is `SPEC.md` + `DECISIONS.md` (functional/rationale truth)
and, for the executor and execution-auditor, **the approved plan itself** (in `plans/`,
§5).

---

## 3. Anchor system

This project uses a **flat two-family** anchor system. There are **no module-prefixed
anchors** (modules are runtime-derived concepts, not doc folders).

| Prefix | Meaning | Lives in | Numbering |
|---|---|---|---|
| **T-D** | Throughline **D**ecision — functional/product decisions | Full body in `DECISIONS.md`; one-line index in `SPEC.md §14` | Sequential, un-padded: `T-D1` … `T-D60` |
| **C-D** | **C**ode **D**ecision — implementation-level decisions | Inline in `CODE_SPEC.md` (under "Anchor convention") | Sequential, un-padded: `C-D1` … `C-D26` |

A C-D either implements a T-D or fills an implementation gap; a C-D can be narrowed or
superseded by a later T-D (e.g. `C-D2` narrowed by `T-D60`). **Do not mint anchors
mid-session** — propose a new one via a working note appended to `DECISIONS.md` and
surface it (a mint is a ratification-class change, §7).

**Not anchors — delivery and audit IDs** (point at the records; do not treat as
canonical decisions):
- **E-slices** (`E1`…`E18`, `E17a`) — Phase E audit-close delivery slices, defined in
  `docs/_meta/throughline/plans/2026-05-30-phase-e-full-audit-close.md`.
- **F / S / SF findings** (`F<section>-NN`, `S<subsystem>-NN`, `SF<n>-NN`) — audit
  findings (feature/spec, security/stability, hybrid), defined in
  `docs/_meta/throughline/audits/` and routed to E-slices.

---

## 4. Halt classes

The **only** sanctioned reasons work stops. Canonical source:
`docs/_meta/throughline/AUTO_CONTINUE_WORKFLOW.md` (§"The Three Halt Classes").
Role files refer to these **by category**.

The **three codified** halt classes:
1. **Spec drift** — work touches behaviour the spec does not sanction → halt, surface to
   the spec author (fix is a SPEC update or a code rollback, never a silent patch).
2. **Circuit breaker** — three fix-rounds on the same finding/failure on the same slice →
   halt, do not push a fourth.
3. **Explicit user pause** — the kill switch is detected at a slice boundary → halt,
   record the reason, await resumption.

> **Known gap (audit-relevant):** additional halt-class extensions ("halt-4…9") were
> **blessed by the spec author during Phase E but have not been codified** into
> `AUTO_CONTINUE_WORKFLOW.md`. They live, un-canonicalised, in the Phase E wake-logs
> (e.g. `docs/_meta/throughline/plans/phase-e-audit-wake-log.md`). Until they are written
> into the workflow doc, treat the **three above as the authoritative codified set** and
> surface anything that looks like a blessed-but-uncodified extension rather than relying
> on it. Closing this gap is owed work, not settled doctrine.

---

## 5. Path conventions

All under `docs/_meta/throughline/` unless noted. Verified against the live tree.

| Artifact | Convention |
|---|---|
| Plans | `plans/YYYY-MM-DD-<scope>.md` (e.g. `2026-05-30-phase-e-full-audit-close.md`). **Approved plans live here** — the executor/execution-auditor's source of truth. |
| Wake-logs | `plans/YYYY-MM-DD-<scope>-wake-log.md` (e.g. `2026-06-02-planner-role-file-wake-log.md`). Co-located with plans. *(Reviewers may instead keep their wake-log on their own review branch — see §7.)* |
| Audits | `audits/YYYY-MM-DD-<audit-scope>.md` (e.g. `2026-05-28-audit-3-functional-correctness.md`). |
| Handovers | `handovers/<merge-date>-<slice-id>-<short-summary>.md`, authored from `docs/_meta/throughline/HANDOVER_TEMPLATE.md`. Written at every PR close; immutable once written (single confidentiality carve-out — see SESSION_START "Handover discipline"). Only the `throughline` area carries handovers. |

There are **no** `experiments/`, `reconciliations/`, or `docs/_meta/<area>/handovers/`
directories — do not assume them. The only other subdirectory is `mockups/` (UI design
artifacts).

---

## 6. Context for sessions — living documents & pointers

| What | Where |
|---|---|
| Current project state | `docs/_meta/throughline/PLATFORM_STATUS.md` (the living doc; read it on startup, §1). |
| Most recent handover | newest file in `docs/_meta/throughline/handovers/` — read before anything else per SESSION_START. |
| Audit reports | `docs/_meta/throughline/audits/`. |
| Wait/wake skill | `.claude/skills/counterpart-change-detector/` (`SKILL.md` + `reference/operating-guide.md`). All six roles depend on it for self-waking on a counterpart's branch/comment activity — do not reimplement polling. |
| The role files | `.claude/roles/` — `planner.md`, `plan-auditor.md`, `plan-overseer.md`, `executor.md`, `execution-auditor.md`, `execution-overseer.md`. |

---

## 7. Operational & governance parameters

The role files delegate the following **load-bearing parameters** to this file (they are
not optional hints — without them sessions re-litigate behaviour each cycle). Values
below reflect the convention the workflow has actually been operating under.

### Merge method — two contexts
- **Role-trio review loops** (plan-trio and execution-trio; the overseer is the
  merge-executor): **squash merge.** This is the documented convention in the overseer
  role frontmatter ("flip draft→ready and squash-merge") and the observed practice for
  the role-file PRs (#121, #122, #125–#130 all squash-merged).
- **Auto-continue build-slice chain**: **merge commit**, per
  `AUTO_CONTINUE_WORKFLOW.md §D` ("Throughline's repo norm — every prior PR on `main`
  lands as a two-parent merge commit; squash and rebase strategies are not used").

These are deliberately different and must not be conflated: squash for the role-trio
merge-executor; merge-commit for the chain runner. *(See the findings note below — the
two were never reconciled in a single doc.)*

### Override window
**24 hours** of wall-clock after the third (converging) sign-off lands at the
convergence SHA. A **present** spec author who ratifies or voices no objection
**collapses the window to zero**; the full 24h only bounds spec-author *absence*
(role files §8.2).

### Ratification scope-classes
Changes that do **not** auto-merge on the three-sign-off gate and require **explicit
spec-author ratification** first (role files §8.3; codified in PR #126):
- **(i)** a mint of, or change to, a **canonical anchor** (T-D / C-D);
- **(ii)** a **spec amendment** (a change to `SPEC.md` / `CODE_SPEC.md` / `DECISIONS.md`);
- **(iii)** a **scope decision** (what work is in or out of scope);
- **(iv)** anything that sets **durable project-level precedent**.

### Wake-log path
`docs/_meta/throughline/plans/YYYY-MM-DD-<scope>-wake-log.md` (§5). The content-producer
(planner / executor) keeps the wake-log here, alongside the plan/change output.
Reviewers (auditor / overseer) keep their wake-log on **their own review branch** so
their markers stay off the canonical PR branch.

### Status-line token (final marker)
The final marker is a commit that flips an in-artifact status-line token to the state:

> **`final — approved by <role>`**

where `<role>` is the exact role name — `planner`, `plan-auditor`, `plan-overseer`,
`executor`, `execution-auditor`, or `execution-overseer` (role files §4.7 / §8). The
producer's marker is an in-doc / in-PR status line; reviewers' markers sit on their own
branch. *(In practice this has been carried on a `Status:` line, e.g.
`Status: final — approved by executor`; the role-file wording — em-dash, exact role name —
is canonical.)*

### Dormant-wait bound
**3 consecutive watcher lifetimes (~90 minutes) of zero counterpart activity** before a
reviewer-side role transitions from active re-arming to the dormant-wait stand-down
(role files §4.9 / §4.10). *(The role files say only "a small number of consecutive
watcher lifetimes" and delegate the exact integer here — this is the **first concrete
value set**; it is amendable if practice shows it is wrong.)*

### Merge-eligibility on counterpart silence
- **Producer/author silence** (planner or executor goes quiet): may degrade to a
  **discretionary spec-author merge on the strength of a *completed* independent audit**
  (`AUTO_CONTINUE_WORKFLOW.md`, author-silence amendment). This is the spec author's call
  to invoke, never a reviewer's.
- **Reviewer silence** (auditor or overseer goes quiet): **not** a merge license — there
  is no completed audit to merge on, so convergence simply blocks. A reviewer-side role
  never merges to force progress past a silent counterpart.

The convergence **topology** itself (three independent sign-offs, overseer-executed
merge, spec-author override/ratification authority) is **not** project-tunable — it is
baked into the role files. Only the *posture* above is project policy.

### Verification bar
The bar a change must clear before merge: the **three-layer green gate** — Gitar review +
CI + GitHub mergeable, simultaneously green at one SHA (`AUTO_CONTINUE_WORKFLOW.md`) —
plus the pre-work / post-work doc gates in `AUTHORING_DISCIPLINE.md`.
