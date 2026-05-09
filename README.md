# Throughline

A local, single-user session companion for parallel AI-coded development.

Throughline tracks outstanding work across multiple Claude Code sessions, surfaces drift in completed items by combining static rule checks (Semgrep) with semantic code search (Semble), and turns saved notes and prompts into active memory.

## Status

**Pre-implementation.** This repository currently contains only the v1 specification and supporting documents. No code yet. The next session will begin Phase 1 (see [`ROADMAP.md`](ROADMAP.md)).

## What it does

- **Tracks outstanding work** — todos and decisions with status lifecycle, blockers, tags, and infinite nesting. Items live in one pool; sessions are saved views over that pool.
- **Captures messy input** — paste a Claude Code transcript, drop a `.md` file, dictate, or jot to the scratchpad. AI extracts and classifies; you review before items land.
- **Stores reference material** — notes, prompts, snippets, imported docs in a searchable library.
- **Detects drift on completed items** — tiered signal system from Semgrep failures, GitHub revert events, code-touch detection, and dump-zone heuristics.
- **Closes the loop with GitHub** — polls for PR events, surfaces status, auto-reconciles on merge with confidence-thresholded apply.

See [`SPEC.md`](SPEC.md) for the full functional description.

## Disclaimers

- **Single user.** Designed for one person on one laptop. No multi-user model. No auth. No sharing.
- **Local only.** Backend and UI both run on your machine. No cloud sync; the only cross-device mechanism is copying the datastore file.
- **Private.** This repo is not public-distribution software. No license is included in v1.

## Architecture (high level)

Two pieces, both on your laptop:

- **Backend service** — long-lived local process. Handles persistence, file watching, Semble and Semgrep integration, GitHub polling, scheduled work (reminders, periodic reviews), Anthropic API calls, and Claude Code → Throughline push. Auto-runs on login.
- **Browser UI** — served from the backend over a local-only address. The browser does not access the filesystem, OS notifications, or external networks directly; the backend mediates everything.

Closing the browser tab does not stop background work — reminders fire, polling continues, drift checks run.

## Install and run

The build hasn't started yet. Once Phase 1 lands, this section will document the single-command setup. Until then, see [`ROADMAP.md`](ROADMAP.md) for the build plan and [`CODE_SPEC.md`](CODE_SPEC.md) for implementation choices.

## Documentation

| File | Role |
|---|---|
| [`SPEC.md`](SPEC.md) | Functional spec — authoritative for *what* Throughline does and *why*. |
| [`CODE_SPEC.md`](CODE_SPEC.md) | Technical implementation spec — authoritative for *how*. |
| [`DECISIONS.md`](DECISIONS.md) | Full text of every T-D decision anchor referenced in `SPEC.md` §14. |
| [`ROADMAP.md`](ROADMAP.md) | Sequenced build plan, phase by phase. |
| [`CHECKLIST.md`](CHECKLIST.md) | Per-phase build state. Read at session start; update at session end. |

## Dependencies

Throughline integrates with — but does not bundle:

- **Anthropic API** (account + key) for all AI features
- **GitHub** (account + PAT) for repo and PR awareness
- **Semgrep + GitHub Actions** on your repo for tier-1 drift detection
- **Semble** for local code search

It degrades gracefully when these are absent: no Anthropic key disables AI but everything else works; no GitHub PAT disables polling but sessions remain editable; no Semble disables code Q&A and tier-3 drift detection.

## Owner

Kunda Tech (Jay).
