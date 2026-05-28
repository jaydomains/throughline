# Throughline bootstrap

You are bootstrapping a Throughline project from an existing repository. Your
task is to read the repository's documentation, apply the project's bound
methodology bundle as extraction policy, and emit a structured import file
that Throughline ingests via its bootstrap import endpoint.

The fixed parameter block at the top of this prompt (YAML frontmatter) supplies
three absolute paths:

- `bundle_path` — the resolved methodology bundle file (Markdown). Read it.
  The bundle's §2 (project layout), §5 (lifecycle), §6 (communication model),
  and §7 (items policy) sections describe the extraction rules you must apply.
- `repo_root` — the canonical repository root. All documentation you read for
  bootstrap lives under this directory.
- `output_path` — where to write your structured output. Write a single JSON
  file at this path of the shape documented below.

## Step 1 — Read the bundle

Read the file at `bundle_path` in full. Walk its h2/h3 sections. The bundle
defines:

- **§2 project-layout** — where decisions, roadmap, checklist, handovers, and
  related artefacts live within `repo_root`. Use this to locate source files.
- **§5 lifecycle** — the legal `status` transitions for items. Every item row
  you emit must carry a status that exists in this lifecycle.
- **§6 communication-model** — types, tiers, and edge contracts. Informational
  for now; not required in the output rows.
- **§7 items policy** — the set of legal `type` values for items, plus
  per-type field requirements. Every item row you emit must carry a type that
  exists in this policy.

If a section the bundle declares is absent from the repository (no decisions
file, no roadmap, no handover directory), proceed without that source — emit
fewer rows, not a failure. The output file should always parse.

## Step 2 — Extract rows

Walk the repository at `repo_root` and produce rows for three sections:

### `items`

One row per discrete unit of in-flight work. Sources include (per §2):

- decisions and design notes (one row per anchor)
- roadmap phases (one row per phase)
- checklist tasks (one row per checked or pending task)
- handover punch-lists (one row per outstanding line)

Each row carries:

- `bootstrap_id` (required) — stable identifier per source type (see §
  "Bootstrap ID derivation" below)
- `source_type` (required) — one of `decision`, `roadmap`, `handover`,
  `checklist`, `override`
- `title` (required) — short human-readable label
- `type` (required) — one of the bundle §7 legal types
- `status` (required) — one of the bundle §5 statuses legal for that type
- `description` (optional) — longer context
- `blocker_text` (optional) — if status is "blocked", what is blocking it
- `branch_ref` (optional) — git branch reference if known
- `tags` (optional) — string array

### `sessions`

One row per discrete working session (handover document, dated checkpoint).
No bundle validation applies; sessions are type-agnostic.

Each row carries:

- `bootstrap_id` (required) — stable identifier (typically `handover:<filename>`)
- `source_type` (required) — typically `handover`
- `started_at` (required) — ISO 8601 timestamp
- `summary` (optional) — what the session accomplished

### `library_entries`

One row per durable reference artefact (decisions document anchors, principle
records, library-managed templates). No bundle validation applies.

Each row carries:

- `bootstrap_id` (required) — stable identifier
- `source_type` (required) — one of `decision`, `library`, `override`
- `title` (required)
- `content` (optional) — body / rationale

## Step 3 — Bootstrap ID derivation

`bootstrap_id` is the project's stable identity for a row. Same input on
re-bootstrap must produce the same ID — that's how Throughline detects
re-imports vs new rows. Per source type:

- `decision:<anchor-id>` — e.g. `decision:T-D53`, `decision:WN-clone-Q2`,
  `decision:PRINCIPLE-1` (custom bundle anchors are fine)
- `roadmap:phase-<n>` — e.g. `roadmap:phase-21`
- `handover:<filename>` — e.g. `handover:2026-05-25-session-3.md`. Sub-anchors
  permitted: `handover:2026-05-25-session-3.md#sub-anchor`
- `checklist:<sha256-16>` — the 16-character hex prefix of the SHA-256 of the
  normalised text (lowercase, collapsed whitespace, trimmed, stripped trailing
  punctuation). Throughline applies the same normalisation on ingest.
- `override:<slug>` — when the source carries an explicit override marker
  `<!-- @bootstrap-id: my-slug -->` in its content, use `override:my-slug`
  instead of the source-type-derived ID. Override always wins.

## Step 4 — Exclusions

The bootstrap import file must NOT carry:

- Secrets, API keys, tokens, credentials of any kind
- Audit log history
- Embeddings or vector data
- Settings, configuration, or methodology bindings
- Runtime state (last-active project, session locks, watcher state)

Throughline ingests these from other sources; bootstrap is for documented
in-flight work, not state.

## Step 5 — Write the output

Write a single JSON file at `output_path` with this shape:

```json
{
  "version": 1,
  "items": [ /* item rows */ ],
  "sessions": [ /* session rows */ ],
  "library_entries": [ /* library rows */ ]
}
```

The file is read once by Throughline's chokidar watcher; you don't need to
signal completion separately. After writing, your work here is done — return
control to the user.

## Graceful degradation

- Bundle missing a section → skip the rule it would impose; emit rows that
  satisfy the remaining rules.
- Repository missing a documented directory → emit zero rows from that source;
  proceed with others.
- Ambiguous status / type → choose the most conservative legal value (typically
  "open" / "todo" for status, the bundle's default item type for type) and
  carry the original wording into `description`.

A bootstrap that under-populates is recoverable (the user re-runs with edits);
a bootstrap that fails to write the output file is not. Prefer fewer rows over
no output.
