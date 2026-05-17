# Handoff · Throughline UI · hi-fi visual layer

## Overview

This handoff covers a hi-fi visual redesign of the Throughline UI — the methodology runtime described in `SPEC.md`. The current codebase (`packages/frontend/`) is functionally complete through Phase 15 but its `styles.css` is utilitarian (the default dark theme with blue accent that ships in the repo). This design lays a new visual layer over the same data model and view-mode plumbing: every screen, component, and interaction maps to existing code that's already in place.

The design ships **three tweakable directions** so the user can settle on one (or pick traits from each) before committing:

- **Direction A · Quiet Rigor** — Linear/Plane school. Geist sans, hairlines, indigo accent. Restrained.
- **Direction B · Editorial Spec** — Instrument Serif headings, IBM Plex Sans body, warm paper / ink, rust accent. Reads like a well-set engineering doc.
- **Direction C · Terminal Atelier** — IBM Plex Mono everywhere, IDE-flavoured, amber phosphor. Keyboard-first vocabulary (`$ throughline_` prompt, `[bracket·notation]` chips).

Each direction supports light and dark. Density toggle: compact / comfortable / spacious. Accent picker per direction.

---

## About the design files

The `prototype/` folder is a runnable HTML+React design reference, not production code. It uses inline JSX through Babel because that's our prototyping environment — your job is not to copy this HTML into the repo, it's to **recreate the visual treatment in the existing `packages/frontend/` React app**, swapping out the current `src/styles.css` and updating existing components to match. The data shapes, route names, view modes, and component boundaries in the prototype mirror what the codebase already has — so the work is almost entirely CSS + light JSX restructuring, not new architecture.

When the prototype shows a screen the codebase hasn't fully built yet (e.g. a dump zone with paste + review modal that's currently a footnote in `SessionView.tsx`), treat it as a forward-looking design for those phases — implement as time permits, leave existing stubs functional in the meantime.

## Fidelity

**High-fidelity.** Pixel-perfect — exact hex values, font families, weights, sizes, line-heights, hairline thicknesses, and spacing scales are all in `theme.css` as CSS custom properties. Use the tokens directly; don't approximate.

---

## How to read this handoff

Start with the running prototype to see the directions in motion (`open prototype/index.html`). Use the Tweaks panel in the bottom-right to flip between directions / themes / density / accent.

Then:

1. Adopt the tokens from `theme.css` into `packages/frontend/src/styles.css` (or split into a `tokens.css` + per-direction CSS files; your call).
2. Walk the screen-by-screen specs below and update the corresponding existing components.
3. Wire up the direction/theme switch as a real setting (it's currently a Tweaks-panel-only override).

---

## Stack mapping · which prototype file edits which repo file

| Prototype file | Repo target | Notes |
|---|---|---|
| `theme.css` | `packages/frontend/src/styles.css` | Replace wholesale (keep direction = A · dark as the default to start) |
| `capture.css` | merge into `styles.css` | Capture surface styles |
| `shell.jsx`   `Header` | `packages/frontend/src/components/Header.tsx` | + new `Wordmark.tsx` |
| `shell.jsx`   `Sidebar` | new file: `components/Sidebar.tsx` | Sidebar nav is new — currently the codebase uses a `ViewToggle` strip in the header |
| `shell.jsx`   `CommandPalette` | `components/CommandPalette.tsx` | Visual update only — fuzzy search logic via `fuse.js` already wired |
| `wordmark.jsx` | new file: `components/Wordmark.tsx` | Direction-specific glyph component |
| `screens-home.jsx` | new file: `views/HomeView.tsx` | Replaces current Home stub; pulls from existing hooks (`useItems`, `useDriftInbox`, `useDirectives`, `useCostMeter`) |
| `screens-session.jsx` | `views/SessionView.tsx` + `components/Board.tsx` + `components/ItemRow.tsx` + `components/ItemDetailPanel.tsx` | Visual update; behaviour unchanged |
| `screens-gates.jsx` | `views/GatesView.tsx` | Visual update; gate-firing data flows in unchanged |
| `screens-drift.jsx` | `views/DriftInbox.tsx` | Two-tab layout (code/discipline) is new; data model unchanged |
| `screens-capture.jsx` | `components/DumpZone.tsx` + `components/DumpZoneReviewModal.tsx` + new `views/CaptureView.tsx` | Promotes the dump zone to a first-class view with its own route; existing modal becomes the "review-before-apply" sheet |
| `icons.jsx` | new file: `components/Icon.tsx` | 15-glyph inline SVG icon set, 14px at currentColor |

---

## Design tokens

The single source of truth is `theme.css`. Everything is CSS custom properties on `[data-direction]` × `[data-theme]` × `[data-density]` selectors on `<body>`. The app should set those three attributes at the top level and let CSS resolve the rest.

### Direction A · Quiet Rigor

**Typography**

| Variable | Value |
|---|---|
| `--font-body` | `'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif` |
| `--font-display` | `'Geist'` (same) |
| `--font-mono` | `'Geist Mono', ui-monospace, SFMono-Regular, monospace` |
| `--display-weight` | `600` |
| `--display-tracking` | `-0.018em` |

**Light**

| Token | Hex |
|---|---|
| `--bg` | `#fafaf9` |
| `--surface` | `#ffffff` |
| `--surface-2` | `#f4f4f3` |
| `--surface-3` | `#efefee` |
| `--hairline` | `#e6e6e3` |
| `--hairline-2` | `#d4d4d0` |
| `--fg` | `#0a0a0a` |
| `--fg-2` | `#2a2a2a` |
| `--fg-muted` | `#767672` |
| `--fg-faint` | `#a3a39e` |
| `--accent` | `#4f46e5` (indigo) |
| `--warn` | `#d97706` |
| `--danger` | `#dc2626` |
| `--ok` | `#16a34a` |
| `--info` | `#2563eb` |

**Dark**

| Token | Hex |
|---|---|
| `--bg` | `#0c0c0e` |
| `--surface` | `#131316` |
| `--surface-2` | `#1a1a1e` |
| `--surface-3` | `#222227` |
| `--hairline` | `#25252b` |
| `--hairline-2` | `#353540` |
| `--fg` | `#ededf0` |
| `--fg-2` | `#cfcfd4` |
| `--fg-muted` | `#84848e` |
| `--fg-faint` | `#5b5b64` |
| `--accent` | `#818cf8` |
| `--warn` | `#f59e0b` |
| `--danger` | `#f87171` |
| `--ok` | `#4ade80` |
| `--info` | `#60a5fa` |

### Direction B · Editorial Spec

**Typography**

| Variable | Value |
|---|---|
| `--font-body` | `'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif` |
| `--font-display` | `'Instrument Serif', ui-serif, Georgia, serif` |
| `--font-mono` | `'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace` |
| `--display-weight` | `400` |
| `--display-tracking` | `-0.005em` |
| `--fs-display` | `36px` |
| `--fs-xl` | `26px` |
| `--fs-lg` | `20px` |

**Light** (warm paper)

| Token | Hex |
|---|---|
| `--bg` | `#f3eee5` |
| `--surface` | `#faf6ed` |
| `--surface-2` | `#ede6d6` |
| `--surface-3` | `#e2d9c4` |
| `--hairline` | `#d6cab1` |
| `--hairline-2` | `#b5a684` |
| `--fg` | `#1a1611` |
| `--fg-2` | `#3a3327` |
| `--fg-muted` | `#7a6b54` |
| `--fg-faint` | `#9e8f74` |
| `--accent` | `#b8542a` (rust) |
| `--warn` | `#b45309` |
| `--danger` | `#991b1b` |
| `--ok` | `#166534` |
| `--info` | `#1e40af` |

**Dark** (deep ink)

| Token | Hex |
|---|---|
| `--bg` | `#14110c` |
| `--surface` | `#1c1813` |
| `--surface-2` | `#25201a` |
| `--surface-3` | `#2e2820` |
| `--hairline` | `#3a3327` |
| `--hairline-2` | `#524736` |
| `--fg` | `#ede4d0` |
| `--accent` | `#e89066` |

### Direction C · Terminal Atelier

**Typography**

| Variable | Value |
|---|---|
| `--font-body` | `'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace` |
| `--font-display` | same as body |
| `--font-mono` | same as body |
| `--display-weight` | `500` |
| `--display-tracking` | `-0.01em` |
| `--fs-base` | `12.5px` |
| `--fs-display` | `26px` |

**Light**

| Token | Hex |
|---|---|
| `--bg` | `#f1efe7` |
| `--surface` | `#f7f5ed` |
| `--hairline` | `#c8c3ad` |
| `--fg` | `#1a1a14` |
| `--accent` | `#b4521a` |

**Dark**

| Token | Hex |
|---|---|
| `--bg` | `#0a0b08` |
| `--surface` | `#11130d` |
| `--surface-2` | `#181a13` |
| `--hairline` | `#2a2d20` |
| `--hairline-2` | `#3f4330` |
| `--fg` | `#d2cfa8` (phosphor) |
| `--accent` | `#f0a235` (amber) |
| `--ok` | `#9bc77c` |
| `--danger` | `#ef5350` |

### Shared sizing tokens

| Variable | Value | Notes |
|---|---|---|
| `--fs-xs` | `11px` | Hairline labels, eyebrow, audit timestamps |
| `--fs-sm` | `12px` | Default UI text |
| `--fs-base` | `13px` (12.5 in C, 14 in spacious density) | Body text |
| `--fs-md` | `15px` | Slightly bumped UI text (panel titles) |
| `--fs-lg` | `18px` | h3 |
| `--fs-xl` | `22px` (26 in B) | h2 |
| `--fs-display` | `32px` (36 in B, 26 in C) | Hero h1 |
| `--radius-sm` / `--radius` / `--radius-lg` | **0 / 0 / 0** | Sharp corners — `2px` only in direction C on `--radius-lg` |

Density (sets row height + padding + gap):
- `compact`: `--row-h: 26px; --pad: 6px; --gap: 6px; --gap-lg: 10px;`
- `comfortable` (default): `--row-h: 32px; --pad: 8px; --gap: 8px; --gap-lg: 14px;`
- `spacious`: `--row-h: 38px; --pad: 12px; --gap: 12px; --gap-lg: 20px;`

### Direction-switching mechanism

The prototype switches direction by setting three attributes on `document.body`:

```js
document.body.setAttribute('data-direction', 'A' | 'B' | 'C');
document.body.setAttribute('data-theme',     'light' | 'dark');
document.body.setAttribute('data-density',   'compact' | 'comfortable' | 'spacious');
```

Persist these in the existing settings layer (`packages/backend/src/settings/...`). New keys: `theme_direction`, `theme_mode`, `theme_density`. Default `A` / `dark` / `comfortable`. Hot-reload from settings via SSE (the channel is already there for live updates).

---

## Wordmark

Three direction-specific treatments. All three components share the same `Wordmark` API: `<Wordmark direction="A" | "B" | "C" />`. Source in `prototype/wordmark.jsx`.

### A · Quiet
```
[+] THROUGHLINE
```
A 22×22 square outline glyph with a `+` cross in `var(--fg)` and a thin `var(--accent)` horizontal stroke running through the midline (the literal "through-line"). Word in 15px Geist 600 with `0.18em` letter-spacing, accent-coloured hairlines flanking left and right.

### B · Spec
```
Throughline   │   No. 01 · Phase 15
```
Instrument Serif italic 28px, with a small-caps mono subline separated by a 1px hairline. Reads like a masthead.

### C · Term
```
$ throughline_
```
IBM Plex Mono 13px 500, with a `$` prompt in `var(--accent)` and a blinking 7×13px cursor block in `var(--accent)` (1.1s steps animation).

The wordmark is clickable everywhere in the app — clicking it navigates to `home`.

---

## App shell layout

```
┌──────────────────────────────────────────────────────────────┐
│ Header — 56px (48px in C)                                    │
├──────────┬───────────────────────────────────────────────────┤
│ Sidebar  │                                                   │
│ 240px    │   Main view area                                  │
│          │   max-width 1200px, padding 28px 32px 80px        │
│          │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

Grid: `grid-template-columns: 240px 1fr; grid-template-rows: 56px 1fr; grid-template-areas: "head head" "side main";`

### Header

Children in order:
- Wordmark (direction-specific component)
- 1px×22px vertical hairline
- Project switcher (square badge with 2-char short, project name, `· bundle_id` in mono muted, chevron-down)
- Spacer
- Scratchpad pill (icon + "scratchpad" + count in mono)
- Cost pill (live dot + "cost" + `$X.XX / day` in mono)
- Live channel pill (pulsing dot + "live")
- Jump pill (search icon + "jump" + `⌘K` kbd)

`.head-pill` is a thin 1px bordered rect, 4×10 padding, font-size 11px, color `--fg-muted`. **Not** rounded.

### Sidebar

Two groups separated by `.section-label` rows:

**Project**: Home · Dump zone · Sessions · Primary units · Tree · Graph · Library
**Methodology**: Gates · Drift inbox · Directives

Each item is a `.nav-item` row with icon + label + optional count badge (right-aligned, mono 10.5px, left-bordered) and optional `.badge-warn` (left-bordered colored count in warn).

Active state: `background: var(--accent-soft)`, `color: var(--accent)`. In direction B, active uses `--surface-2` with a 1px hairline border instead (less candy-coloured against the warm paper).

Bottom of sidebar:
- Phase mini-bar (4-segment status: scope / spec / p15 / v1 with done/active states)
- Branch name in mono faint
- Settings link (with top-dashed-border)

### Main area

- Max-width 1200px
- Padding: 28px 32px 80px (20px 24px 80px in C)
- Eyebrow line (mono uppercase muted) above every h1
- Hero h1 in `--font-display` at `--fs-display`

---

## Screens — per-screen specs

### Home

**Purpose**: across-everything daily landing — items in progress this week, drift signals, recent Claude Code pushes, methodology phase indicator. The user's "Sunday morning" surface.

**Layout**: Hero with eyebrow + h1 + meta + actions. 4-column stat strip (1px hairline grid, no rounding). 2-column grid below: left = in-progress + blocked + drift summary, right = phase card + CC timeline + periodic-review nudge.

**Components**

- `.home-hero` — flex row, items-end, justify-between, border-bottom hairline.
  - left: `eyebrow` → `h1` ("Sunday morning") + when in mono muted → meta muted line
  - right: `Session start` ghost btn + `+ Capture` primary btn (navigates to Dump zone)
- `.home-stats` — `display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--hairline); border: 1px solid var(--hairline);` (hairline grid trick — cells have `background: var(--surface)`)
  - Each cell `.stat`: label (10px mono uppercase, fg-faint) → value (26px display, baseline-aligned with delta in mono 11px) → tertiary (sparkline / mono detail)
- `.section-divider` — eyebrow num (mono in A/C, italic serif 30px in B) + `h2` in display, optional right-aligned ghost button. **No bottom border in B**; hairline in A/C.
- In-progress card (no padding) — list of items, each row a 70px id / 1fr title+meta / auto pr-pill grid. Click → open detail panel + navigate to sessions.
- Blocked card — same layout, blocker text in muted (italic in B), stale pill + anchor on right.
- Drift list — see Drift section below; 1px-gap hairline grid.
- Phase card — h3 "Phase · gate state" + phase-bar (4 segments) + gate firing rows (pill + label + when) + `Review gate firings` btn.
- CC timeline — `.timeline` with left rail (`::before`), `.tl-item` with `when` (mono 10.5 faint) + `what` (fg-2) + `ref` (mono muted 11). Accent dot for the most recent.
- Periodic-review nudge — card with 2px left accent border, h3 in accent, two btns.

### Sessions (with detail panel)

**Purpose**: the work surface. Pick a session, see boards by item type, slide-in detail.

**Layout**: 2-col grid: left = `.sessions-rail` (220px), right = `.session-main`. Detail panel slides in from right over the main area.

**Components**

- `.sessions-rail` — 220px, border-right hairline. Eyebrow + session links + horizontal rule + `+ new session` ghost btn.
- `.session-link` — name (with leading 6×6 square dot, accent when active) + meta line (mono 10px faint, gap-separated metadata).
- `.session-header` — eyebrow + h1 (26px in A, 30px in B) + branch line (mono 11 muted) + toolbar (ghost btns: session-start, retro, primary btn `+ item`).
- `.board` — h3 + count, hairline-dashed bottom rule (solid in C).
- `.board-cols` — `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))`. Each column has a header (6×6 status-coloured dot + label + count) and stacked `.item` cards.
- `.item` (todo/decision card) — 1px hairline, no radius, padding 10×12, gap 6px. Children: title (500, line-height 1.35), meta row (id mono · anchor in accent · tags · stale flag ⚑ · drift flag ↯ · pr#nnn). Selected state: 1px accent border + 1px accent box-shadow.

#### Detail panel (slide-in from right)

- 520px wide (`max-width: 92vw`), full height
- Backdrop with `rgba(0,0,0,0.25)` and 2px blur
- `transform: translateX(100%)` → `0` on open; 200ms `cubic-bezier(0.16,1,0.3,1)`
- Header section: id (mono 11 muted) + type pill (ghost mono) + status pill (color-keyed by status) + stale/drift pills + close btn. Below: large title (display 22px, line-height 1.15). Below: meta row with anchor-chip + tags.
- Body sections (all separated by `border-top: 1px solid var(--hairline)`):
  1. Description (`.detail-md`, prose 13px, line-height 1.6; 14px / 1.65 in B)
  2. Methodology context — `.detail-row` grid (100px label / 1fr value, mono labels uppercase 10.5px tracking 0.06em)
  3. Blockers (if any) — text in warn + structured `blocked by` rows
  4. Git — branch / pr / sessions rows
  5. Code references · semble — file:line in mono 11
  6. Activity · audit history — `.audit-row` grid (110px when / 90px actor / 1fr field), each row 1px dashed bottom border

#### Keyboard

- `↑` / `↓` cycles through the parent list with the panel staying open and updating
- `Esc` closes
- Click backdrop closes

### Gates

**Purpose**: see methodology gate firings across all phase moments. Failures are *proposals*, never blocks.

**Layout**: hero (h1 + last 24h count in mono muted) → 4-stat strip (passing / failing / skipped / hooks installed) → info banner ("Failures surface as proposals. Throughline never silently blocks.") → grouped moment cards.

**Components**

- `.gates-moment` — bordered card per phase moment.
  - `.moment-h` — surface-2 bg, padding 14×18, hairline bottom border. Left: name (display 16px / 22px in B) + key (mono 11 muted). Right: status pills + 11px mono description.
  - `.gate-firing` — `grid-template-columns: 28px 1fr auto` rows separated by `border-top: 1px solid var(--hairline)`.
    - `.status` — 22×22 round badge with mono glyph (`✓ ✕ – !`) coloured + soft-tinted by status
    - `.body` — title (600, 15px) with gate-key (mono 11) + target line (muted 12) + `.findings` list
    - `.findings .finding` — surface-2 bg, mono 11, grid for msg + location
    - `.actions` — right-aligned when (mono 10.5 faint) + override / fix-&-retry btns on failure
- Below: hooks-installed card (pre-commit / post-commit rows showing advisory/exit-0 status per T-D44)

### Drift inbox

**Purpose**: triage both streams of drift — code (4 tiers) and discipline (bundle-defined categories).

**Layout**: hero → tab strip (Code drift / Discipline drift / right-aligned auto-dismiss note) → tier-count cards (code only) → feed of drift cards.

**Components**

- `.drift-tabs` — flex row, bottom-border hairline. Each `.drift-tab` has icon + label + mono count; active tab has 2px accent bottom border (negative margin -1px to overlap the row hairline).
- `.drift-tiers` — `grid-template-columns: repeat(4, 1fr)`. Each `.tier-card` shows lbl (mono 10.5 faint uppercase) + n (display 26px, coloured by tier: t1 danger, t2 #e8821e, t3 warn, t4 muted) + desc (11px muted).
- `.drift-card` — `grid-template-columns: 80px 1fr 220px`. Left: tier-label stack (mono coloured + lbl + when). Middle: reason + item-ref (item id in accent mono) + optional AI re-verify line (italic in non-C, normal in C). Right: PR pill + action buttons (re-verify · ai / re-open item, or for tier-4: dismiss / open as item).

### Capture / Dump zone

**Purpose**: the seven capture surfaces, with paste/drop the primary path. Everything funnels through review-before-apply (T-D5).

**Layout**: hero → destination toggle (segmented control) + target selector → paste area card → "Other capture sources" grid → recent dumps feed.

**Components**

- `.seg` — flex row with 1px hairline, no radius. `.seg-btn` items with right-border between, on-state uses surface-2 (or accent-soft in direction C).
- `.dz` — bordered area; `.dz-h` (surface-2 header with metrics), `.dz-area` (textarea in mono, no border, 16px padding), `.dz-actions` (surface-2 footer with ghost btns + cost + primary "Propose →").
- `.capture-sources` — `repeat(auto-fit, minmax(240px, 1fr))` grid with 1px hairline gaps (same trick as home stats). Each `.cap-card` shows key (mono 10.5 faint uppercase) + status pill + title (15px 600; serif 22px in B) + desc (12.5 muted) + meta row.
- `.recent-dumps` — vertical list with hairline separators. `.rd-row` is `90px / 1fr / auto`: kind (mono 10.5 faint uppercase) + body (source + meta in mono) + state pill (ok / warn / ghost).

#### Review modal (the "AI proposed X items" sheet)

- Full-width sheet, `min(1100px, 94vw)`, max-height 86vh
- Header: eyebrow ("Review before apply · sonnet · {bundle_id}") + h2 ("AI proposed 4 items") + muted clarifying-question count → right: Cancel ghost + Apply primary
- Table (`.proposal-tbl`): 6 columns (checkbox / title / type / session / primary unit / confidence)
- Each row: title + description (muted 11, line-height 1.55) + tag chips + optional semble code ref (mono faint with "semble" in accent)
- Confidence values colored: ≥ 0.85 → ok, < 0.85 → warn
- Clarifying row underneath an item: surface-2 bg with 2px accent left border, the clarifying question text + answer buttons (`local TZ` / `UTC` / `skip`)
- Rejected rows: `opacity: 0.4` + line-through (checkbox unaffected)
- Footer: surface-2, mono faint cost & prompt-fingerprint line

### Command palette (`⌘K`)

**Purpose**: jump to any project / session / item / action / view.

**Layout**: backdrop with 4px blur, modal centered at 14vh top, `min(640px, 92vw)` wide, max-height 70vh.

**Components**

- Input: 16px font, 16×20 padding, transparent bg, hairline bottom border
- Result groups (Projects / Views / Items / Actions): each preceded by a `.group-h` mono 10px uppercase faint row
- Each result row: `grid-template-columns: 26px 1fr auto` — icon + label + sub (mono 11 muted) + kind tag (mono 10 uppercase tracking 0.08em). Selected row uses `--accent-soft` bg.
- Footer: hairline top border, 4 kbd hints + project name on right
- Animation: backdrop 120ms opacity fade; modal 140ms transform with `cubic-bezier(0.16,1,0.3,1)` and `translateY(-8px) scale(0.98)` → `0,1`

#### Keyboard
- `⌘K` / `Ctrl+K` toggles
- `↑` / `↓` selects
- `Enter` activates
- `Esc` closes

---

## Pill, tag, and chip vocabulary

| Class | Shape | Use |
|---|---|---|
| `.pill` | 1px bordered, no fill | Status, count, tier — replaces the soft-tinted pastel pills that read "AI dashboard" |
| `.pill.accent` / `.warn` / `.danger` / `.ok` / `.info` | Color + 50%-mix border, no fill | Status-coloured pills |
| `.pill.mono` | Adds mono font | For IDs, counts |
| `.pill.ghost` | Transparent fill, hairline border | Type labels, etc. |
| `.tag` | 18px height, 6px padding, mono 10.5px, surface-2 bg, hairline border | Item tags |
| `.anchor-chip` | Mono 10.5px, accent text, dotted underline | Anchor refs (e.g., `T-D38`, `C-D9`) |
| `.kbd` | Mono 10.5px, hairline border, surface-2 bg, 2px bottom-border | Keyboard hints |
| `.badge-warn` | Mono 10px, warn text, left-border | Count badges on nav-items for failing gates / open drift |
| `.head-pill` | Hairline, transparent, mono `dot` indicator | Header pills |

**No fills on status pills.** This was a deliberate move away from the soft-pastel-tinted look. Color lives in the text and a transparent-mixed border; fills stay reserved for selection states and a few specific surfaces (`.review-sheet`, hover states).

---

## Interactions & motion

| Where | Property | Duration | Easing |
|---|---|---|---|
| Detail panel slide-in | `transform: translateX(100% → 0)` | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Detail backdrop fade | `opacity 0 → 1` | 180ms | linear |
| Command palette backdrop | `opacity 0 → 1` | 120ms | linear |
| Command palette modal | `translateY(-8px) scale(0.98) → 0, 1` | 140ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Terminal cursor (direction C) | `opacity blink` | 1.1s | `steps(2)` infinite |

No hover-scale, no "magic-card" effects, no parallax — this is a power tool, not a marketing surface.

---

## Icon set

15 inline-SVG glyphs at 14px (configurable via `size` prop), 1.25 stroke-width, `currentColor` stroke, round caps + joins, no fills (line icons only). Source in `prototype/icons.jsx`. Names: `home`, `session`, `tree`, `graph`, `library`, `gate`, `drift`, `directives`, `modules`, `settings`, `search`, `note`, `prompt`, `item`, `action`, `view`, `project`, `chevron`, `chevron-down`, `clock`, `flag`, `spark`, `check`, `x`, `cmd`.

Port directly into `components/Icon.tsx` with a `name: string; size?: number` props interface.

---

## State management

The visual layer doesn't introduce new state — every datum already flows through the existing hooks:

- `useItems` / `useSessions` / `useDirectives` / `useDriftInbox` / `useCostMeter` / `useBackendHealth` / `useBackupStatus` / `useStaleThreshold` / `useMethodologies` / `useProjects` / `useSSE`
- Routing: existing react-router setup with `/projects/:id/...`
- Detail panel open state: lift to `SessionView.tsx` (component already exists); arrow-key cycling already wired

New persisted state (three settings keys):
- `theme_direction` (`'A' | 'B' | 'C'`, default `'A'`)
- `theme_mode` (`'light' | 'dark'`, default `'dark'`)
- `theme_density` (`'compact' | 'comfortable' | 'spacious'`, default `'comfortable'`)

Hot-reload via the existing SSE channel so theme changes propagate without refresh.

---

## Fonts

Loaded from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

For a backend-served local-only app, consider self-hosting these (download the woff2 files, ship them under `packages/frontend/public/fonts/`, and use `@font-face` declarations) — Throughline runs offline and the Google CDN dependency would otherwise force a network call on every cold load.

---

## Suggested implementation order

1. **Tokens + direction switching** — drop `theme.css` into `styles.css`, wire `data-direction` / `data-theme` / `data-density` from settings (default A · dark · comfortable). Verify a few existing screens light up.
2. **Wordmark + Header + Sidebar shell** — biggest visible win. Replace the `ViewToggle` strip with the new Sidebar; move the header to the new layout.
3. **Pill/tag/icon vocabulary** — strip rounded corners, soft-tinted pill fills, and pastel badges from existing components. Single global pass.
4. **HomeView** — currently a stub; this is the biggest new surface.
5. **SessionView + ItemRow + ItemDetailPanel** — visual update only; the existing component tree maps 1:1.
6. **GatesView** — visual update, plus the "hooks installed" footer.
7. **DriftInbox** — promote to two-tab layout with tier-count cards.
8. **CaptureView + DumpZoneReviewModal** — promote dump zone to first-class view; redesign the review modal as the full-sheet table layout.
9. **CommandPalette** — visual update; logic unchanged.
10. **Stub screens** (modules / tree / graph / library / directives / settings) — apply the new vocabulary as those phases get built out.

---

## Files in this handoff

```
design_handoff_throughline_ui/
├── README.md                     (this file)
└── prototype/
    ├── index.html                Entry point — open this to view
    ├── theme.css                 All design tokens × directions × themes × density
    ├── capture.css               Dump-zone-specific styles
    ├── data.jsx                  Mock data (project, sessions, items, drift, gates)
    ├── icons.jsx                 15-glyph SVG icon set
    ├── wordmark.jsx              Direction-specific wordmark component
    ├── shell.jsx                 Header, Sidebar, CommandPalette
    ├── screens-home.jsx          Home dashboard
    ├── screens-session.jsx       Session view + boards + ItemDetailPanel
    ├── screens-gates.jsx         Methodology gates view
    ├── screens-drift.jsx         Drift inbox (two streams)
    ├── screens-capture.jsx       Dump zone + review modal
    ├── app.jsx                   Routing + tweaks integration
    └── tweaks-panel.jsx          Tweaks panel (dev tool — strip from prod)
```

Run with any static server (e.g. `python -m http.server` in `prototype/`, then open `http://localhost:8000/`).

---

## Notes

- The Tweaks panel (bottom-right floating control) is a prototyping device — **do not ship it**. The three settings keys above replace it for end users.
- The mock data in `data.jsx` is fictional. The shape mirrors the real DB columns (`packages/backend/src/items/...`) — use it as a sanity check that nothing's been added/removed in the visual layer.
- The wordmark glyph in direction A draws its `+` cross inline; the horizontal accent stroke is an `::after` pseudo on the outer span. If you replace the SVG with a different mark, keep the through-line stroke — it's the conceptual hook of the name.
- Direction C's terminal cursor relies on `@keyframes blink`. If you have a reduced-motion preference, gate it behind `@media (prefers-reduced-motion: no-preference)`.

If anything in this README contradicts the running prototype, the prototype is the source of truth.
