# Test-bundle methodology bundle

A generic, business-neutral fixture that exercises the bundle grammar non-trivially:
a primary unit with tier rules, an anchor system, a marker system, a phase state
machine, two item types on separate boards with distinct per-type lifecycles, a
multi-gate phase moment, companion modes, templates, and discipline-drift
categories. It carries no real methodology — it exists only so the runtime and
tests have a rich bundle to parse that is safe to ship in a public repository.

## 1. Identity

name: test-bundle
version: 1.0.0
authority_precedence: bundle > project settings

## 2. Project layout

### Primary unit

name: component
tier_rules: tier-1 <=2 items; tier-2 <=5 items; tier-3 >5 items
- SPEC.md
- NOTES.md

### Runtime artefact directories

- docs/_meta
- docs/handovers

## 3. Anchor system

namespace: A-D
format_regex: ^A-D\d+$
body_sections: Decision, Context, Rationale
status_vocabulary: active, superseded
heading_tags: A-D
banned_content_in_bodies: TODO, FIXME
- active -> superseded

## 4. Marker system

formats: [PENDING], [REVIEW]
- blocking
- informational

## 5. State machine

phases: backlog, active, review, done
transitions: backlog -> active, active -> review, review -> done, done -> active

### Item type: task

board: Tasks
statuses: open, doing, blocked, done
transitions: open -> doing, doing -> blocked, blocked -> doing, doing -> done, done -> open

### Item type: note

board: Notes
statuses: draft, published
transitions: draft -> published, published -> draft

### Gates: pre-write

- anchors-resolve | mechanical | every cited A-D anchor must resolve to a live decision

### Gates: per-commit

- structure-check | mechanical | required files present and sections ordered
- banned-string-sweep | mechanical | no banned strings introduced by the commit

### Gates: pr-open

- no-blocking-markers | mechanical | no live [PENDING] markers in affected files

## 6. Communication model

- emit
- consume
- depends-on

## 7. Gating model

- tier-1 components: single board, no gate ceremony
- tier-2 components: per-commit gates enforced
- tier-3 components: per-commit + pr-open gates enforced

## 8. Review patterns

companion_modes: standard, strict

### Companion mode: standard

### Companion mode: strict

### Checklist: review

- anchor-citation-validation | mechanical | every cited anchor resolves and is not superseded
- scope-assessment | judgement | the slice's scope matches what was planned

## 9. Templates

### Template: session_start:standard

# Session start — {{project_name}} (standard)

You are working on a test-bundle-bound component in standard mode. Open items:

{{open_items_list}}

### Template: session_start:strict

# Session start — {{project_name}} (strict)

You are working on a test-bundle-bound component in strict mode. Cited anchors must
resolve and per-commit gates must pass. Open items:

{{open_items_list}}

### Template: handover

# {{project_name}} — Handover

Build state, last decision minted, active blockers, files changed.

### Template: decision

# {{anchor_id}} — {{title}}

Decision / Context / Rationale.

## 10. Validation rules

- TODO
- FIXME

### Drift category: banned-strings

trigger: file-change
check: banned_string
details: TODO / FIXME must not appear in committed docs

### Drift category: structural-conformance

trigger: pre-write
check: structural
details: required files present, sections ordered, anchor bodies well-formed

### Drift category: anchor-resolution

trigger: manual
check: cross_reference
details: every cited A-D anchor must resolve to a live decision in the docs

## 11. Authority hierarchy

source_ranking: spec > code > tracker
drift_policy: silent drift is the failure mode this whole discipline exists to prevent
