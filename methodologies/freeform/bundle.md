# Freeform methodology bundle

The minimum-spec bundle for projects that just want a task tracker. Declares no primary unit,
no anchors, no markers, no gates, and no review checklists. Throughline core treats every
"none" declaration below as legitimate (T-D47, C-D4) — downstream subsystems become no-ops.

## 1. Identity

name: freeform
version: 1.0.0
authority_precedence: bundle > project settings

## 2. Project layout

none

## 3. Anchor system

none

## 4. Marker system

none

## 5. State machine

phases: open, done
transitions: open -> done, done -> open

## 6. Communication model

none

## 7. Gating model

none

## 8. Review patterns

none

## 9. Templates

### Template: session_start:default

# Session start — {{project_name}}

You are working on a freeform-bound Throughline project. There are no methodology anchors,
markers, or gates to satisfy — just a single board of tasks. Open items:

{{open_items_list}}

## 10. Validation rules

none

## 11. Authority hierarchy

source_ranking: spec > code > tracker
drift_policy: silent drift is the failure mode this whole discipline exists to prevent
