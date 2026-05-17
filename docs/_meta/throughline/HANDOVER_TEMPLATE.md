<!-- HANDOVER_TEMPLATE.md — paste into a new dated file at the end of every slice/PR. Date the filename with the PR's merge date (UTC). Filename pattern: <YYYY-MM-DD>-<slice-id>-<short-summary>.md -->

<!-- Manually authored at slice close — content reconstructed from the PR description, commit messages, and evidence paths landed by this slice. Honesty rule: any section that cannot be reconstructed from artefacts says so explicitly. Do not fabricate. -->

<!-- Template version: 1.0 -->

# <Project / Module> Handover

**Generated:** <YYYY-MM-DD HH:MM UTC>
**Last commit SHA:** <merge-commit-sha> — <YYYY-MM-DD>
**Previous handover:** `<relative path to prior handover file>` (<prior slice label>)

---

## Build State vs Spec

What this slice was supposed to deliver and what actually landed. One row per deliverable. Evidence column points at the concrete artefact (file path, line range, checklist entry, migration file, test file) that proves the row.

| Spec requirement | State | Evidence | Notes |
|---|---|---|---|
| <Requirement 1> | built / partial / missing | `<file path or checklist line>` | <if partial: what's missing> |
| <Requirement 2> | built | `<file path>` | _none_ |
| ... | ... | ... | ... |

If a deliverable is `partial`, the Notes column must name what's outstanding and where it's tracked (deferred to next slice / blocked on dependency / out of scope per decision X).

---

## Last Decision Minted

Decisions formalised in this PR's scope. A decision is something that locks an approach in for downstream slices — a rule, an anchor, an architectural choice.

- **<Decision ID or short name>** — one-line statement of the rule. Rationale: <why this and not alternatives>. Lands in: `<file path>`.

If this slice didn't mint any new decisions (most don't), say so explicitly:

> No new decisions minted. Implementation followed existing decisions <list IDs>. Implementation-shape choices recorded in <code-spec equivalent file path>.

---

## Active Blockers

Things stopping forward progress. If none, say `_none_` rather than leaving the section blank.

- <Blocker 1> — what it blocks, what unblocks it, what the workaround is (if any).
- <Blocker 2> — ...

Flag-gated stubs go here too: if this slice landed a stub waiting on an external dependency, name the stub, the flag, and the trigger that flips the flag.

---

## Files Changed Since Last Handover

Generated from `git log --name-only <previous-handover-commit>..HEAD` or the PR's file list. Group by purpose:

**New:**
- `<path>` — one-line purpose

**Modified:**
- `<path>` — one-line summary of change

**Deleted:**
- `<path>` — why

If the PR is large, summarise by area rather than enumerating every file. The point is "where did the work land," not exhaustive cataloguing.

---

## Drift Flags

Deviations from the original plan caught during the slice. These are honest "we expected X, found Y, did Z" notes. Empty `_none_` is the most common state.

| Flag | File | What drifted | How resolved |
|---|---|---|---|
| <Drift 1> | `<path>` | <expected vs actual> | <fix applied / accepted as-is / deferred> |

Drift flags surface scope creep, plan-vs-reality gaps, and shape changes that future contributors need to know about. Be honest — drift isn't failure, hidden drift is.

---

## Open Questions

Things deferred to a future slice or session. Each item names what it is and where it'll be resolved.

- [ ] <Question 1> — landing site for resolution.
- [ ] <Question 2> — landing site for resolution.

If none, say `_none_`.

---

## Recently Resolved

Things this slice closed that were open in a prior handover. Cross-reference the prior handover that flagged them.

- <Item 1> — was flagged in `<prior-handover-file>` as <type>; resolved by <commit / decision / mechanism>.
- <Item 2> — ...

If none, say `_none_`.

---

## Cross-Module Dependencies

If your project has internal module boundaries, name the dependencies that this slice's work introduces, depends on, or unblocks.

**Upstream (this module consumes):**
- <Module / external dep> — what's consumed (endpoint, contract, schema).

**Downstream (consumes this module):**
- <Module> — what it consumes from this slice's work, and whether that consumer is built / pending.

If this slice has no cross-module surface, say `_none_` in both.

---

## Reference

- Spec / decisions / build-state docs this slice operates against: <list paths>
- PR: <link or number>

---

## Authoring rules (delete this section in real handovers — it's here for the template only)

1. **Write at slice close, before push.** Final commit of every slice PR is the handover.
2. **Source from artefacts, not memory.** PR description + commit messages + evidence paths are the source of truth. If a section can't be filled from artefacts, say so explicitly rather than fabricate.
3. **Brevity over comprehensiveness.** Each section is a few lines, not a wall of text. The handover is a state document, not a narrative.
4. **`_none_` is a valid value.** Don't leave sections blank; explicitly mark empty ones.
5. **Previous-handover pointer is navigation, not history.** Update it if the chain order changes. It's a link, not a dated claim.
6. **Date prefix on filename = merge date (UTC).** Not authoring date. Date the file when you know when it'll merge; if writing pre-merge, use the planned merge date.
7. **Filename slug stays kebab-case.** `<YYYY-MM-DD>-<slice-id>-<short-summary>.md`. No spaces, no underscores, no caps.
8. **Handovers are immutable once written — with one carve-out.** A merged handover is a historical record and is not edited by later sessions. The sole exception: a change that business confidentiality, privacy, or legal requirements compel (e.g. scrubbing a business-internal name before the repo is made public, removing accidentally-committed personal data). Such an edit is itself a slice: make it deliberately, note it in the slice's own handover, and prefer meaning-preserving substitution (generic placeholder) over deletion so the historical narrative still reads truthfully. Routine wording/quality fixes do **not** qualify.
