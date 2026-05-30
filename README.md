# Throughline

Throughline is a local, single-user methodology runtime for AI-assisted software development. It loads a *methodology bundle* — a single declarative document that codifies a project's documentation discipline (file conventions, anchor format, marker taxonomy, build-phase state machine, review patterns, validation rules) — and then enforces that discipline as runtime behaviour: it parses the project's docs against the bundle, gates build phases, runs review checklists as structured workflows, and surfaces drift between intent and implementation. The distinction that matters is that the discipline is not advisory — it is executable. The conventions that keep AI-assisted development honest, and that are otherwise re-enacted by hand every session, become rules the runtime applies and refuses to let slide.

It exists because keeping global state across many concurrent AI coding sessions, fragmented `.md` files, and chat scrollback overwhelms working memory — and because the discipline that holds a project together is, today, mostly held in someone's head.

## Status

The **bootstrap-and-clone-and-go arc is feature-complete and production-ready end-to-end** (as of 2026-05-28). The full v1 runtime is in place: methodology bundle loading and hot-reload, the items, sessions, and capture tracker, the reconcile engine, library, directives, discipline-drift and code-drift detection, GitHub polling, the methodology gate runtime, companion review, session-start scaffolding, the RAG/intelligence layer, backup, and a cost meter. 500 backend + 182 frontend tests pass; CI enforces `typecheck` / `test` / `lint` / `build`.

This is a personal project developed in the open. Work continues — further phases are queued in [`ROADMAP.md`](ROADMAP.md) and specific surfaces are still maturing. Throughline is single-user and local-only by design: one person, one laptop, no auth, no cloud sync.

The repo ships only a minimal `freeform` default bundle and a generic `test-bundle` grammar fixture; the rich discipline bundles that make Throughline interesting live outside the repo and bind per-project. There is no turnkey first run that solves a problem for you out of the box. Setup is at the bottom if you want to run it, but the docs are the primary destination — the interesting objects here are the runtime and the discipline framework it was built with, and those are best understood by reading.

## What's interesting here

The application is one thing; the discipline framework it was built with is another, and the second may be the more novel. Throughline is built against its own documentation discipline — the same kind of methodology it runs for other projects — so the repository is a working demonstration of the thing it teaches. A few pieces worth a look:

- **Spec-driven build.** [`SPEC.md`](SPEC.md) owns *what* and *why*; [`CODE_SPEC.md`](CODE_SPEC.md) owns *how*. The code is the source of truth for what's built, and any disagreement between spec and code must be reconciled or recorded as a deliberate decision. Silent drift is the failure.
- **The anchor system (T-D / C-D).** Every consequential decision is minted as a citable, status-tracked anchor: **T-D** for functional/technical decisions (in [`DECISIONS.md`](DECISIONS.md)) and **C-D** for implementation decisions (in `CODE_SPEC.md`). Anchors move `active → superseded`; the runtime validates that cited anchors resolve.
- **The auto-continue workflow.** Build runs as a chain of single-phase branches. Each PR must clear a three-layer gate — automated review, CI, and GitHub mergeable state — before the chain advances to the next slice. It halts on spec drift, a circuit breaker (three fix-rounds), or an explicit pause.
- **The status taxonomy and cohort-hardener cadence.** "Feature complete" and "production ready" are not synonyms. Deliverables move through `spec-anchored → pre-work-doc-complete → feature-complete → production-ready`. A per-slice *light hardener* runs at each close; a *cohort hardener* re-runs cross-cutting checks across a whole cluster of phases to catch drift no single slice would see — stale anchor counts, missing ROADMAP sections, orphan vocabulary. [`AUTHORING_DISCIPLINE.md`](docs/_meta/throughline/AUTHORING_DISCIPLINE.md) codifies it.

## Architecture

A TypeScript monorepo (pnpm workspaces), two pieces running on your laptop:

- **Backend** (`packages/backend`) — a Fastify service over SQLite (`better-sqlite3`). Loads and hot-reloads methodology bundles (via `chokidar`), parses project docs, runs the gate and discipline-drift engines, polls GitHub, calls the Anthropic API, and serves the UI.
- **Frontend** (`packages/frontend`) — React + Vite. The tracker surface: items, sessions, library, directives, drift, gates. The browser never touches the filesystem or external network directly; the backend mediates everything.
- **Shared** (`packages/shared`) — TypeScript types for bundles, items, sessions, gates, drift, audit, and the rest. No runtime logic.

A bundle is a single Markdown file with a fixed eleven-section grammar (identity, project layout, anchor system, marker system, state machine, communication model, gating model, review patterns, templates, validation rules, authority hierarchy). The **bootstrap pipeline** brings an existing project in: a generic, repo-owned prompt instructs Claude Code to read the project's bundle and docs and emit a structured import file (items, sessions, and library entries with stable bootstrap IDs); Throughline ingests it as an idempotent upsert — re-runs detect new vs. updated vs. stale rows and never silently overwrite a user's edits.

## Where to go deeper

The docs are the project. Start here:

| Doc | What it covers |
|---|---|
| [`SPEC.md`](SPEC.md) | Functional spec — what Throughline does and why (authoritative). |
| [`CODE_SPEC.md`](CODE_SPEC.md) | Technical implementation spec — how it's built. |
| [`DECISIONS.md`](DECISIONS.md) | Full text of every T-D decision anchor. |
| [`ROADMAP.md`](ROADMAP.md) | Sequenced, phase-by-phase build plan. |
| [`AUTHORING_DISCIPLINE.md`](docs/_meta/throughline/AUTHORING_DISCIPLINE.md) | The status taxonomy and doc gates the project is built against. |
| [`PLATFORM_STATUS.md`](docs/_meta/throughline/PLATFORM_STATUS.md) | Living current-state snapshot. |

## Built with Claude Code

Throughline was built with [Claude Code](https://claude.com/claude-code), in the auto-continue chain described above: single-phase branches, gated PRs, and dated handovers reconstructed from each PR's artefacts. The repository looks the way it does in part because of how it was built — the discipline framework above is as much a record of that process as it is a feature of the product.

## License and setup

MIT — see [`LICENSE`](LICENSE).

Requires Node.js 22+ and `pnpm`.

```
pnpm install

# Dev (hot reload on both):
pnpm dev        # backend on 127.0.0.1:47823
pnpm dev:web    # frontend on 127.0.0.1:5173 (proxies /api, /events, /health)

# Or build and serve the UI from the backend:
pnpm build
pnpm --filter @throughline/backend start   # http://127.0.0.1:47823
```

State lives at `~/.throughline/`. For full install notes, dependency details, and how to bind a project to your own bundle, see [`SPEC.md`](SPEC.md) and the docs above.
