# Throughline

A local, single-user methodology runtime for AI-assisted software development.

Throughline loads a methodology bundle that codifies your documentation discipline — file conventions, anchor format, marker taxonomy, build phases, review patterns, validation rules — then applies that methodology to one or more projects you bring. On top of the runtime sits a familiar work tracker, a reference library, and an intelligence layer. The same Throughline supports any project that has a methodology bundle declared for it.

## Status

**Phase 3 in progress.** Phases 1 + 2 + 3 complete: backend runtime substrate, browser UI shell, and items + sessions + manual entry + item detail panel landed. A freeform-bound project now tracks tasks end-to-end with bundle-derived boards, structured + free-text blockers (T-D8), tags, parent/child nesting, branch refs (T-D38), session memberships, and a slide-in detail panel with arrow-key cycling, stale yellow flag (T-D46), and the full audit history per item. Capture surfaces, library, reconcile engine, and the gate runtime still ahead.

## What it does

The product has three layers:

- **Methodology runtime (core).** Loads a bundle describing how a project is documented and built. Parses the project's docs against the bundle, runs review checklists as structured workflows, gates build phases, surfaces discipline drift, scaffolds session handovers. The repo ships only a minimum-spec `freeform` bundle (the default) and a generic `test-bundle` grammar fixture; your own discipline lives in a bundle kept *outside* this repo and bound per-project via `bundle_path` (see [Configuring a user-owned bundle](#configuring-a-user-owned-bundle)).
- **Tracker (surface over the runtime).** Items, sessions, library, directives, drift detection, audit log — a work-tracking surface informed by the methodology beneath. Items know which primary unit they belong to, which anchor they cite, what phase they're in, whether their PR has cleared the methodology's gates.
- **Intelligence layer (over both).** AI-assisted dump zone extraction, reconcile, chat, RAG over the project's docs and code, end-of-session retros, dependency sequencing, stakeholder rendering, drift re-verification. Always reviewable before applying.

**Multi-project from v1.** Multiple projects coexist in one Throughline instance. Each binds to a methodology bundle; the freeform bundle is the default at project create.

See [`SPEC.md`](SPEC.md) for the full functional description.

## Disclaimers

- **Single user.** Designed for one person on one laptop. No multi-user model. No auth. No sharing.
- **Local only.** Backend and UI both run on your machine. No cloud sync; the only cross-device mechanism is copying the datastore file.
- **Private.** This repo is not public-distribution software. No license is included in v1.

## Architecture (high level)

Two pieces, both on your laptop:

- **Backend service** — long-lived local process. Handles persistence, methodology bundle loading and enforcement, project doc parsing, file watching, Semble and Semgrep integration, GitHub polling, scheduled work (reminders, periodic reviews), Anthropic API calls, and Claude Code → Throughline push. Auto-runs on login.
- **Browser UI** — served from the backend over a local-only address. The browser does not access the filesystem, OS notifications, or external networks directly; the backend mediates everything.

Closing the browser tab does not stop background work — reminders fire, polling continues, drift checks run, methodology gates enforce.

## Install and run

Requires Node.js 20+ and `pnpm`.

```
pnpm install

# Two-terminal dev flow (hot reload on both):
pnpm dev                 # backend on 127.0.0.1:47823 (tsx watch)
pnpm dev:web             # frontend Vite dev server on 127.0.0.1:5173 (proxies /api, /events, /health to the backend)

# Or build everything and serve the UI from the backend:
pnpm build
pnpm --filter @throughline/backend start
# Then visit http://127.0.0.1:47823
```

The backend binds to `127.0.0.1:47823` by default (configurable via `THROUGHLINE_PORT`). State lives at `~/.throughline/` — SQLite datastore, secrets file, and the Claude Code inbox archive. Login auto-start per platform is documented at [`docs/install/auto-start.md`](docs/install/auto-start.md).

A minimal CLI ships with the backend:

```
pnpm --filter @throughline/backend exec tsx src/cli/index.ts health
pnpm --filter @throughline/backend exec tsx src/cli/index.ts projects create --name Demo --repo /path/to/repo
pnpm --filter @throughline/backend exec tsx src/cli/index.ts projects list
```

For the broader build plan see [`ROADMAP.md`](ROADMAP.md) and [`CODE_SPEC.md`](CODE_SPEC.md).

## Configuring a user-owned bundle

Throughline ships only the `freeform` default and a generic `test-bundle` fixture under `methodologies/`. Your own methodology — file conventions, anchor format, gates, review patterns — lives in a directory **outside this repo** so it never enters the public codebase.

1. Author a `bundle.md` following the eleven-section grammar (see `methodologies/test-bundle/bundle.md` for a worked example) and put it in a directory you control, e.g. `~/methodologies/my-discipline/bundle.md`.
2. Point a project at it by setting `bundle_path` to that directory (the directory that *contains* `bundle.md`), via the project create/update API:

```
curl -X POST http://127.0.0.1:47823/api/projects \
  -H 'content-type: application/json' \
  -d '{"name":"My Project","repo_path":"/path/to/repo","bundle_id":"my-discipline","bundle_path":"/home/me/methodologies/my-discipline"}'
```

When `bundle_path` is set, the loader resolves `<bundle_path>/bundle.md` instead of `methodologies/<bundle_id>/bundle.md`, and watches it for live hot-reload exactly like the bundled ones. Leave `bundle_path` unset to use a repo-shipped bundle (`freeform` by default). `bundle_id` stays required either way as the project's declared bundle identifier.

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
- **Semgrep + GitHub Actions** on repos whose bundle declares Semgrep-based verifier rules (a rich user bundle may; freeform does not)
- **Semble** for local code search

It degrades gracefully when these are absent: no Anthropic key disables AI but everything else works; no GitHub PAT disables polling but sessions remain editable; no Semble disables code Q&A and code-drift tier 3; a project bound to the freeform bundle gets a methodology-free tracker experience natively.

## Owner

Kunda Tech (Jay).
