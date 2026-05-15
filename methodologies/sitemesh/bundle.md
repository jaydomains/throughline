# SiteMesh methodology bundle

The rich-discipline reference bundle (T-D41). Declares a primary unit (module), an anchor
system, a marker system, a phase state machine with multi-gate phase moments, two item
types on separate boards (T-D42, §7.5), companion-review patterns, templates, and
discipline-drift categories. Throughline's runtime is methodology-agnostic (T-D39); every
SiteMesh-specific term below is data the runtime reads, not code it hardcodes (T-D48).

## 1. Identity

name: sitemesh
version: 1.0.0
authority_precedence: bundle > project settings

## 2. Project layout

### Primary unit

name: module
tier_rules: tier-1 <=2 items; tier-2 <=5 items; tier-3 >5 items
- SPEC.md
- CODE_SPEC.md
- DECISIONS.md
- CHECKLIST.md

### Runtime artefact directories

- docs/_meta
- docs/handovers

## 3. Anchor system

namespace: T-D, C-D
format_regex: ^(T-D|C-D)\d+$
body_sections: Decision, Context, Rationale, Implications
status_vocabulary: active, superseded, deprecated
heading_tags: T-D, C-D
banned_content_in_bodies: TODO, FIXME, XXX
- active -> superseded
- active -> deprecated

## 4. Marker system

formats: [UNRESOLVED-(b)], [UNRESOLVED-(c)], [RATIONALE NEEDED]
- blocking
- informational
- rationale-gap

## 5. State machine

phases: scaffolding, drafting, doc-ready, code-ready, done
transitions: scaffolding -> drafting, drafting -> doc-ready, doc-ready -> code-ready, code-ready -> done, done -> drafting

### Item type: todo

board: Todos
statuses: todo, in-progress, blocked, done
transitions: todo -> in-progress, in-progress -> blocked, blocked -> in-progress, in-progress -> done, done -> todo

### Item type: decision

board: Decisions
statuses: open, locked, superseded
transitions: open -> locked, locked -> superseded, open -> superseded

### Gates: pre-write

- cited-anchors-resolve | mechanical | every cited T-D / C-D anchor must resolve to a live decision
- subagent-line-numbers | judgement | sub-agent-reported line numbers verified against ground truth
- confident-pattern-check | judgement | confident-sounding claims flagged for ground-truth check

### Gates: per-commit

- verify-structure.sh | mechanical | nine code-architecture rules
- sitemesh-pre-commit | mechanical | docs banned-string sweep

### Gates: plan-mode

- plan-anchors-cited | judgement | the proposed plan cites the decisions it depends on

### Gates: post-commit

- no-banned-strings | mechanical | no banned strings introduced by the commit
- citations-still-resolve | mechanical | all anchor citations still resolve post-commit

### Gates: pr-open

- no-live-unresolved | mechanical | no live [UNRESOLVED-(b/c)] markers in affected SPEC.md files

## 6. Communication model

- emit
- consume
- depends-on

## 7. Gating model

- tier-1 modules: single board, no gate ceremony
- tier-2 modules: per-commit gates enforced
- tier-3 modules: per-commit + pr-open gates enforced

## 8. Review patterns

companion_modes: doc-readiness, code-pr

### Companion mode: doc-readiness

### Companion mode: code-pr

### Checklist: companion-review

- anchor-citation-validation | mechanical | every cited anchor resolves and is not superseded
- marker-presence | mechanical | no live blocking markers past doc-ready
- scope-assessment | judgement | the slice's scope matches what was planned
- regression-assessment | judgement | no done work regressed by this slice

## 9. Templates

### Template: session_start:doc-readiness

# Session start — {{project_name}} (doc-readiness)

You are working on a SiteMesh-bound module in doc-readiness mode. Resolve blocking markers
before advancing the phase. Open items:

{{open_items_list}}

### Template: session_start:code-pr

# Session start — {{project_name}} (code-PR)

You are working on a SiteMesh-bound module in code-PR mode. Cited anchors must resolve and
per-commit gates must pass. Open items:

{{open_items_list}}

### Template: handover

# {{project_name}} — Handover

Build state vs spec, last decision minted, active blockers, files changed, drift flags.

### Template: decision

# {{anchor_id}} — {{title}}

Decision / Context / Rationale / Implications.

## 10. Validation rules

- TODO
- FIXME
- XXX

### Drift category: banned-strings

trigger: file-change
check: banned_string
details: TODO / FIXME / XXX must not appear in committed docs

### Drift category: structural-conformance

trigger: pre-write
check: structural
details: required files present, sections ordered, anchor bodies well-formed

### Drift category: cross-reference

trigger: manual
check: cross_reference
details: cited anchor exists and is not superseded without acknowledgment

## 11. Authority hierarchy

source_ranking: spec > code > tracker
drift_policy: silent drift is the failure mode this whole discipline exists to prevent
