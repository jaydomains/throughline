import { createHash } from 'node:crypto';
import type {
  Item,
  LoadedBundle,
  RelevanceClassification,
  RelevanceTier,
  SessionStartMode,
  SessionStartModesResult,
  SessionStartPromptResult,
} from '@throughline/shared';
import { ProjectNotFoundError } from '@throughline/shared';
import { DomainError, NotFoundError } from '@throughline/shared';
import { appendAudit } from '../../audit/log.js';
import { recordCost } from '../../cost/telemetry.js';
import { promptFingerprint } from '../../ai/fingerprint.js';
import { usdEstimate } from '../../ai/pricing.js';
import type { DB } from '../../db/index.js';
import type { MethodologyRegistry } from '../loader.js';
import type { ProjectsService } from '../../projects/service.js';
import type { ItemsService } from '../../items/service.js';
import type { LibraryService } from '../../library/service.js';
import type { DirectivesService } from '../../directives/service.js';
import type { RelevanceClassifier } from './classifier.js';

// C-D9 — session-start scaffolding. Pipeline: resolve companion mode (bundle-declared
// enum + default) → gather project-state context → Haiku relevance classification →
// render the bundle's per-mode template → return a copy-pasteable prompt. SPEC §9 marks
// this Haiku, output is a prompt to copy (no auto-apply).
//
// Spec gap (CODE_SPEC "Questions for the spec author" #6 — companion modes ↔ review
// patterns relationship): proceeded with bundle-declared enum + default per ROADMAP
// §Phase 13; surfaced in the handover, not silently resolved. No anchor minted.
//
// Schema note: like Phase 12 (C-D8), no migration. The previous assembly's rendered
// prompt + an input fingerprint live in the audit trail (entity_type 'session_start'),
// which is the canonical record and the re-render-without-AI cache (T-D45 kin). Cache
// reuse is an explicit input-fingerprint comparison: an unchanged assembled context
// (mode + open items + anchors + markers + cross-unit deps + include-prompt directives)
// re-serves the cached prompt with no Haiku call; any change regenerates.

export class BundleUnresolvedError extends NotFoundError {
  constructor(id: string) {
    super(`project ${id} bundle could not be resolved`, 'bundle_unresolved');
  }
}
export class InvalidModeError extends DomainError {
  constructor(mode: string) {
    super(`companion mode "${mode}" is not declared by the project's bundle`, { statusCode: 400, code: 'invalid_mode' });
  }
}

const FREEFORM_MODE = 'default';

// Minimum-spec fallback when the bundle's Templates section is "none" or declares no
// session_start template for the resolved mode (C-D9 implication: a freeform-bound
// project's scaffolding produces a minimum-spec prompt).
const MINIMUM_TEMPLATE = `# Session start — {{project_name}}

Companion mode: {{companion_mode}}

Open items:

{{open_items_list}}`;

export interface SessionStartEngine {
  modes(projectId: string): SessionStartModesResult;
  generate(projectId: string, requestedMode?: string | null): Promise<SessionStartPromptResult>;
}

export interface CreateSessionStartEngineOptions {
  db: DB;
  projects: ProjectsService;
  registry: MethodologyRegistry;
  items: ItemsService;
  library: LibraryService;
  directives: DirectivesService;
  classifier: RelevanceClassifier;
}

interface AssembledContext {
  mode: string;
  template: string;
  openItems: Item[];
  decisions: Item[];
  anchors: string[];
  markers: string[];
  // Cross-primary-unit blocker edges: "<blocked title> ⟵ blocked by <blocker title>".
  dependencies: string[];
  // Resolved include-in-prompt directive bodies (T-D12), auto-prepended verbatim.
  includeBlocks: string[];
  // F4-01: the 2 previously-omitted SPEC §7 inputs. `projectSpec` is the canonical
  // `project_spec` library entry's content read directly (bounded); `executionPlan` is the
  // bundle's whole `execution_plan` template. Either is null when absent (block omitted).
  projectSpec: string | null;
  executionPlan: string | null;
  // Stable hash over everything that affects the rendered prompt — the cache key.
  inputFingerprint: string;
}

// F4-01: cap the project-spec content so a long spec can't crowd out the rest of the prompt.
const PROJECT_SPEC_MAX_CHARS = 8000;

export function createSessionStartEngine(
  opts: CreateSessionStartEngineOptions,
): SessionStartEngine {
  const { db, projects, registry, items, library, directives, classifier } = opts;

  function bundleFor(projectId: string): LoadedBundle | null {
    const p = projects.get(projectId);
    if (!p) return null;
    const loaded = registry.resolveBundle(p.bundle_id, p.bundle_path, p.repo_path);
    return loaded.status === 'loaded' ? loaded.bundle : null;
  }

  function declaredModes(bundle: LoadedBundle): SessionStartMode[] {
    const modes = bundle.review_patterns.companion_modes;
    if (modes.length > 0) return modes.map((m) => ({ id: m.id, name: m.name }));
    // Freeform / "none" review patterns expose a single synthetic mode so the surface is
    // uniform and a template can still be keyed (`session_start:default`).
    return [{ id: FREEFORM_MODE, name: 'default' }];
  }

  function resolveMode(bundle: LoadedBundle, requested?: string | null): string {
    const modes = declaredModes(bundle);
    if (requested == null || requested === '') return modes[0]!.id;
    if (!modes.some((m) => m.id === requested)) throw new InvalidModeError(requested);
    return requested;
  }

  function templateFor(bundle: LoadedBundle, mode: string): string {
    const byMode = bundle.templates.session_start_by_mode ?? {};
    return byMode[mode] ?? byMode[FREEFORM_MODE] ?? MINIMUM_TEMPLATE;
  }

  // Last status in a type's lifecycle is treated as terminal; an item is "open" while it
  // is not in that status. Matches freeform (open→done) and multi-status bundles without
  // hardcoding any status vocabulary (C-D12 — per-type lifecycles).
  function openFilter(projectId: string): (it: Item) => boolean {
    const policy = items.policy(projectId);
    return (it) => {
      const lifecycle =
        policy.statuses_by_type[it.type] ?? policy.statuses ?? [];
      const terminal = lifecycle[lifecycle.length - 1];
      return terminal === undefined || it.status !== terminal;
    };
  }

  function citedAnchors(projectId: string): string[] {
    const rows = db
      .prepare(
        `SELECT DISTINCT c.anchor_id AS a
           FROM item_anchor_citations c
           JOIN items i ON i.id = c.item_id
          WHERE i.project_id = ?
          ORDER BY c.anchor_id`,
      )
      .all(projectId) as Array<{ a: string }>;
    return rows.map((r) => r.a);
  }

  function crossUnitDependencies(all: Item[]): string[] {
    const byId = new Map(all.map((it) => [it.id, it]));
    const edges: string[] = [];
    for (const it of all) {
      const blockedUnits = new Set(it.methodology_context.primary_unit_refs);
      for (const blockerId of it.blockers) {
        const blocker = byId.get(blockerId);
        if (!blocker) continue;
        const blockerUnits = blocker.methodology_context.primary_unit_refs;
        // A cross-primary-unit dependency: the blocker sits in a unit the blocked item
        // is not in. Same-unit (or unit-less, freeform) edges are ordinary blockers.
        const crosses =
          blockerUnits.length > 0 &&
          blockedUnits.size > 0 &&
          blockerUnits.some((u) => !blockedUnits.has(u));
        if (crosses) edges.push(`${it.title} ⟵ blocked by ${blocker.title}`);
      }
    }
    return edges.sort();
  }

  function includeBlocks(projectId: string): string[] {
    const dirs = directives.list({ projectId, kind: 'include_prompt' });
    const blocks: string[] = [];
    for (const d of dirs) {
      let body = '';
      if (d.parent_type === 'item') {
        const it = items.get(d.parent_id);
        if (it) body = `${it.title}\n${it.description}`.trim();
      } else {
        const entry = library.get(d.parent_id);
        if (entry) body = `${entry.title}\n${entry.body}`.trim();
      }
      if (body === '') continue;
      const note = (d.payload as { note?: string }).note;
      blocks.push(note ? `> ${note}\n${body}` : body);
    }
    return blocks;
  }

  function assemble(projectId: string, bundle: LoadedBundle, mode: string): AssembledContext {
    const all = items.list({ project_id: projectId });
    const isOpen = openFilter(projectId);
    const openItems = all.filter(isOpen);

    // Decision-bearing items: the boards beyond the first declared item-type carry the
    // methodology's decisions (e.g. the test-bundle's `note` type). Single-type
    // and freeform bundles have none. Bundle-agnostic — no status/type vocabulary baked.
    const policy = items.policy(projectId);
    const decisionTypes = new Set(policy.types.slice(1));
    const decisions = all.filter((it) => decisionTypes.has(it.type));

    const anchors = citedAnchors(projectId);
    const markers = Array.from(
      new Set(openItems.flatMap((it) => it.methodology_context.marker_refs)),
    ).sort();
    const dependencies = crossUnitDependencies(all);
    const blocks = includeBlocks(projectId);

    // F4-01: project-spec excerpts — read the canonical `project_spec` library entry directly
    // (current state at read time; one-per-project by T-D10), NOT via the semantic substrate.
    const specEntry = library.list({ projectId, type: 'project_spec' })[0] ?? null;
    const projectSpec = specEntry
      ? `${specEntry.title}\n${specEntry.body}`.trim().slice(0, PROJECT_SPEC_MAX_CHARS) || null
      : null;
    // F4-01: execution-plan slice — the bundle's whole `execution_plan` template when present.
    // `execution_plan` is a single bundle-global string (not mode-keyed), so "for the chosen
    // mode" is satisfied by mode-driven template *selection*, not by slicing this field.
    const executionPlan = bundle.templates.execution_plan?.trim() || null;

    const template = templateFor(bundle, mode);

    const fp = createHash('sha256');
    fp.update(`mode:${mode}\n`);
    fp.update(`bundle:${bundle.identity.name}@${bundle.identity.version}\n`);
    // Hash the resolved template body, not just the bundle version: bundle files
    // hot-reload (loader watches them) and template edits during development rarely
    // come with a version bump, so a version-only key would serve a stale prompt
    // rendered from the prior template.
    fp.update(`tpl:${template}\n`);
    // Hash the exact fields that reach the rendered prompt (not updated_at, whose
    // millisecond granularity can collide within a request) so a stale render can never
    // be served from cache.
    for (const it of [...openItems].sort((a, b) => a.id.localeCompare(b.id))) {
      fp.update(`item:${it.id}${it.status}${it.title}\n`);
    }
    for (const d of [...decisions].sort((a, b) => a.id.localeCompare(b.id))) {
      fp.update(`dec:${d.id}${d.title}${d.description}\n`);
    }
    for (const a of anchors) fp.update(`anc:${a}\n`);
    for (const m of markers) fp.update(`mrk:${m}\n`);
    for (const e of dependencies) fp.update(`dep:${e}\n`);
    for (const b of blocks) fp.update(`inc:${b}\n`);
    if (projectSpec) fp.update(`spec:${projectSpec}\n`);
    if (executionPlan) fp.update(`plan:${executionPlan}\n`);

    return {
      mode,
      template,
      openItems,
      decisions,
      anchors,
      markers,
      dependencies,
      includeBlocks: blocks,
      projectSpec,
      executionPlan,
      inputFingerprint: fp.digest('hex').slice(0, 32),
    };
  }

  // The latest assembly audit row is the re-render-without-AI cache. Reuse only on an
  // exact input-fingerprint match; any context change regenerates (cache-staleness is an
  // explicit fingerprint comparison, not time- or event-based).
  function cachedPrompt(projectId: string, fingerprint: string): string | null {
    const row = db
      .prepare(
        `SELECT trigger_context_json FROM audit_log
           WHERE entity_type = 'session_start' AND entity_id = ? AND field = 'prompt_assembled'
           ORDER BY timestamp DESC LIMIT 1`,
      )
      .get(projectId) as { trigger_context_json: string } | undefined;
    if (!row) return null;
    try {
      const ctx = JSON.parse(row.trigger_context_json) as {
        input_fingerprint?: string;
        rendered_prompt?: string;
      };
      if (ctx.input_fingerprint === fingerprint && typeof ctx.rendered_prompt === 'string') {
        return ctx.rendered_prompt;
      }
    } catch {
      /* unparseable audit context ⇒ treat as a cache miss and regenerate */
    }
    return null;
  }

  function renderTemplate(template: string, vars: Record<string, string>): string {
    // Substitute {{name}}; an unknown placeholder is blanked so no literal {{…}} leaks
    // into the copyable prompt.
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : '',
    );
  }

  function renderDecisions(
    decisions: Item[],
    tiers: Record<string, RelevanceTier>,
  ): string {
    const lines: string[] = [];
    for (const d of decisions) {
      const tier = tiers[d.id] ?? 'medium';
      if (tier === 'low') continue;
      if (tier === 'high') {
        lines.push(`### ${d.title}\n${d.description}`.trim());
      } else {
        lines.push(`- ${d.title} (${d.id})`);
      }
    }
    return lines.join('\n\n') || '_none_';
  }

  function renderAnchors(anchors: string[], tiers: Record<string, RelevanceTier>): string {
    const kept = anchors.filter((a) => (tiers[a] ?? 'medium') !== 'low');
    return kept.length ? kept.map((a) => `- ${a}`).join('\n') : '_none_';
  }

  function bulletList(values: string[]): string {
    return values.length ? values.map((v) => `- ${v}`).join('\n') : '_none_';
  }

  return {
    modes(projectId) {
      const p = projects.get(projectId);
      if (!p) throw new ProjectNotFoundError(projectId);
      const bundle = bundleFor(projectId);
      if (!bundle) throw new BundleUnresolvedError(projectId);
      const modes = declaredModes(bundle);
      return { modes, default_mode: modes[0]!.id };
    },

    async generate(projectId, requestedMode) {
      const p = projects.get(projectId);
      if (!p) throw new ProjectNotFoundError(projectId);
      const bundle = bundleFor(projectId);
      if (!bundle) throw new BundleUnresolvedError(projectId);

      const mode = resolveMode(bundle, requestedMode);
      const modes = declaredModes(bundle);
      const ctx = assemble(projectId, bundle, mode);

      // Re-render-without-AI: unchanged assembled context ⇒ serve the cached prompt with
      // no Haiku call and no cost. Pure re-read; no new audit row.
      const cached = cachedPrompt(projectId, ctx.inputFingerprint);
      if (cached !== null) {
        return {
          mode,
          modes,
          prompt: cached,
          classifications: [],
          cached: true,
          classifier_used_ai: false,
        };
      }

      const candidates = [
        ...ctx.decisions.map((d) => ({
          ref: d.id,
          text: `${d.title}: ${d.description}`.slice(0, 600),
        })),
        ...ctx.anchors.map((a) => ({ ref: a, text: `anchor ${a}` })),
      ];
      const slice =
        `Project: ${p.name}\nCompanion mode: ${mode}\n` +
        `Open items: ${ctx.openItems.map((it) => it.title).join('; ') || 'none'}`;
      const relevance = await classifier.classify(slice, candidates);

      const includePrefix =
        ctx.includeBlocks.length > 0
          ? `## Include-in-prompt (T-D12)\n\n${ctx.includeBlocks.join('\n\n')}\n\n---\n\n`
          : '';
      // F4-01: the two previously-omitted inputs lead the prompt as labelled blocks (like the
      // include-in-prompt prefix) so they land regardless of whether a bundle template happens
      // to reference them — project spec first (foundational), then execution plan.
      const specPrefix = ctx.projectSpec ? `## Project spec\n\n${ctx.projectSpec}\n\n---\n\n` : '';
      const planPrefix = ctx.executionPlan
        ? `## Execution plan\n\n${ctx.executionPlan}\n\n---\n\n`
        : '';
      const rendered =
        specPrefix +
        planPrefix +
        includePrefix +
        renderTemplate(ctx.template, {
          project_name: p.name,
          companion_mode: mode,
          bundle_name: bundle.identity.name,
          open_items_list: bulletList(ctx.openItems.map((it) => `${it.title} [${it.status}]`)),
          decisions_block: renderDecisions(ctx.decisions, relevance.tiers),
          anchors_block: renderAnchors(ctx.anchors, relevance.tiers),
          markers_block: bulletList(ctx.markers),
          dependencies_block: bulletList(ctx.dependencies),
        });

      const classifications: RelevanceClassification[] = candidates.map((c) => ({
        ref: c.ref,
        tier: relevance.tiers[c.ref] ?? 'medium',
      }));
      // `callMade` (a billed AI call happened) drives cost + the AI-call audit — those
      // reflect resource reality. `classifiedByAi` (the AI produced a usable classification)
      // drives the user-facing classifier_used_ai — an unparseable response makes a call but
      // does not classify, so it is reported as not-AI-classified (T-D60, SF2-04).
      const callMade = relevance.telemetry.model !== null;
      const classifiedByAi = relevance.classified_by_ai;

      // Canonical assembly record + cache (input fingerprint + rendered output). The
      // rendered prompt is user-facing copy output, not an AI input prompt, so it is
      // stored; the AI *input* prompt is never stored, only fingerprinted (T-D24, below).
      appendAudit(db, {
        projectId,
        entityType: 'session_start',
        entityId: projectId,
        actor: 'user',
        field: 'prompt_assembled',
        newValue: mode,
        triggerContext: {
          companion_mode: mode,
          input_fingerprint: ctx.inputFingerprint,
          rendered_prompt: rendered,
          classifier_used_ai: classifiedByAi,
          classifications,
        },
      });

      if (callMade && relevance.telemetry.prompt) {
        // T-D24 — model + salted fingerprint of the AI input prompt; never its body.
        appendAudit(db, {
          projectId,
          entityType: 'session_start',
          entityId: projectId,
          actor: 'ai',
          field: 'relevance_model',
          newValue: relevance.telemetry.model,
          triggerContext: {
            companion_mode: mode,
            model: relevance.telemetry.model,
            prompt_fingerprint: promptFingerprint(
              'session_start_assembly',
              relevance.telemetry.prompt,
            ),
          },
        });
      }

      if (
        callMade &&
        relevance.telemetry.model &&
        (relevance.telemetry.input_tokens > 0 || relevance.telemetry.output_tokens > 0)
      ) {
        recordCost(db, {
          projectId,
          feature: 'session_start_assembly',
          model: relevance.telemetry.model,
          inputTokens: relevance.telemetry.input_tokens,
          outputTokens: relevance.telemetry.output_tokens,
          usdEstimate: usdEstimate(
            relevance.telemetry.model,
            relevance.telemetry.input_tokens,
            relevance.telemetry.output_tokens,
          ),
        });
      }

      return {
        mode,
        modes,
        prompt: rendered,
        classifications,
        cached: false,
        classifier_used_ai: classifiedByAi,
      };
    },
  };
}
