import type {
  HygieneBucket,
  PeriodicReviewResult,
  PeriodicReviewSynthesis,
} from '@throughline/shared';
import type { AnthropicClient } from '../ai/anthropic.js';
import { promptFingerprint } from '../ai/fingerprint.js';
import { usdEstimate } from '../ai/pricing.js';
import { appendAudit } from '../audit/log.js';
import { recordCost } from '../cost/telemetry.js';
import type { DB } from '../db/index.js';
import type { DriftService } from '../drift/service.js';
import type { OrphanRulesService } from '../github/orphan-rules.js';
import type { ItemsService } from '../items/service.js';
import type { MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';
import type { SessionsService } from '../sessions/service.js';
import type { SettingsService } from '../settings/service.js';

// T-D22 — periodic review. Hygiene queries run on audit/state data with NO AI and are
// always available; AI synthesis fires only when the user opens the synthesise action
// (recorded as the "review opened" event, which also drives the due/last-reviewed
// computation). Interval is configurable: project settings_json override → global
// setting → default 2 weeks. Hygiene spans code-drift, discipline-drift, orphaned rules,
// and the bundle-declared discipline-drift categories, plus the SPEC §7.18 staleness
// queries (stale decisions, untouched sessions, longest-held blockers).

const DEFAULT_INTERVAL_DAYS = 14;
const STALE_DECISION_DAYS = 60;
const UNTOUCHED_SESSION_DAYS = 30;
const REVIEW_MODEL = 'claude-sonnet-4-6';
const REVIEW_MAX_TOKENS = 800;

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`project ${id} not found`);
  }
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export interface PeriodicReviewService {
  review(projectId: string): PeriodicReviewResult;
  synthesize(projectId: string): Promise<PeriodicReviewSynthesis>;
}

interface CreateOptions {
  db: DB;
  projects: ProjectsService;
  registry: MethodologyRegistry;
  drift: DriftService;
  orphanRules: OrphanRulesService;
  items: ItemsService;
  sessions: SessionsService;
  settings: SettingsService;
  anthropic: AnthropicClient;
}

export function createPeriodicReviewService(opts: CreateOptions): PeriodicReviewService {
  const { db, projects, registry, drift, orphanRules, items, sessions, settings, anthropic } =
    opts;

  function intervalDays(projectId: string): number {
    const p = projects.get(projectId);
    const proj = p?.settings_json?.periodic_review_interval_days;
    if (typeof proj === 'number' && proj > 0) return proj;
    const g = settings.get('periodic_review_interval_days');
    if (typeof g === 'number' && g > 0) return g;
    return DEFAULT_INTERVAL_DAYS;
  }

  function lastReviewedAt(projectId: string): string | null {
    const row = db
      .prepare(
        `SELECT timestamp FROM audit_log
           WHERE entity_type = 'project' AND entity_id = ? AND field = 'periodic_review_opened'
           ORDER BY timestamp DESC LIMIT 1`,
      )
      .get(projectId) as { timestamp: string } | undefined;
    return row?.timestamp ?? null;
  }

  function buckets(projectId: string): HygieneBucket[] {
    const out: HygieneBucket[] = [];

    const code = drift.listOpenCodeSignals(projectId);
    out.push({
      category: 'code-drift',
      label: 'Open code-drift signals',
      count: code.length,
      entries: code.map((s) => ({ ref: s.id, detail: `${s.category}: ${s.reason}` })),
    });

    const disc = drift.listOpenDisciplineSignals(projectId);
    out.push({
      category: 'discipline-drift',
      label: 'Open discipline-drift signals',
      count: disc.length,
      entries: disc.map((s) => ({ ref: s.id, detail: `${s.category}: ${s.reason}` })),
    });

    const orphans = orphanRules.list(projectId);
    out.push({
      category: 'orphaned-rules',
      label: 'Orphaned verifier rules awaiting cleanup',
      count: orphans.length,
      entries: orphans.map((o) => ({ ref: o.id, detail: o.rule_path })),
    });

    // Bundle-declared discipline-drift categories (SPEC §7.18 "bundle's rules"): surface
    // each declared category with its open-signal count so a category with zero signals
    // is still visible as a hygiene dimension.
    const p = projects.get(projectId);
    const loaded = p ? registry.resolveBundle(p.bundle_id, p.bundle_path) : null;
    const declared =
      loaded && loaded.status === 'loaded'
        ? loaded.bundle.validation_rules.discipline_drift_categories
        : [];
    if (declared.length > 0) {
      const byCat = new Map<string, number>();
      for (const s of disc) byCat.set(s.category, (byCat.get(s.category) ?? 0) + 1);
      out.push({
        category: 'bundle-hygiene',
        label: 'Bundle-declared hygiene categories',
        count: declared.length,
        entries: declared.map((c) => ({
          ref: c.name,
          detail: `${c.check_kind} · ${byCat.get(c.name) ?? 0} open`,
        })),
      });
    }

    // Stale decisions (SPEC §7.18: decisions older than 60 days). Decision-bearing types
    // = the bundle's item types beyond the first (same bundle-agnostic rule as C-D9).
    const policy = items.policy(projectId);
    const decisionTypes = new Set(policy.types.slice(1));
    if (decisionTypes.size > 0) {
      const cutoff = daysAgoIso(STALE_DECISION_DAYS);
      const stale = items
        .list({ project_id: projectId })
        .filter((it) => decisionTypes.has(it.type) && it.created_at < cutoff);
      out.push({
        category: 'stale-decisions',
        label: `Decisions older than ${STALE_DECISION_DAYS} days`,
        count: stale.length,
        entries: stale.map((it) => ({ ref: it.id, detail: `${it.title} (${it.created_at.slice(0, 10)})` })),
      });
    }

    const untouchedCutoff = daysAgoIso(UNTOUCHED_SESSION_DAYS);
    const untouched = sessions
      .list(projectId)
      .filter((s) => s.created_at < untouchedCutoff);
    out.push({
      category: 'untouched-sessions',
      label: `Sessions untouched ${UNTOUCHED_SESSION_DAYS}+ days`,
      count: untouched.length,
      entries: untouched.map((s) => ({ ref: s.id, detail: s.name })),
    });

    // Longest-held blockers: open items carrying a blocker, oldest first.
    const policyAll = items.list({ project_id: projectId });
    const terminalByType = policy.statuses_by_type;
    const blocked = policyAll
      .filter((it) => {
        const lc = terminalByType[it.type] ?? policy.statuses ?? [];
        const terminal = lc[lc.length - 1];
        const open = terminal === undefined || it.status !== terminal;
        return open && (it.blockers.length > 0 || (it.blocker_text ?? '') !== '');
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 10);
    out.push({
      category: 'long-held-blockers',
      label: 'Open items blocked longest',
      count: blocked.length,
      entries: blocked.map((it) => ({
        ref: it.id,
        detail: `${it.title} (since ${it.created_at.slice(0, 10)})`,
      })),
    });

    return out;
  }

  return {
    review(projectId) {
      if (!projects.get(projectId)) throw new ProjectNotFoundError(projectId);
      const interval = intervalDays(projectId);
      const last = lastReviewedAt(projectId);
      const due =
        last === null || Date.now() - new Date(last).getTime() >= interval * 86_400_000;
      return { interval_days: interval, last_reviewed_at: last, due, buckets: buckets(projectId) };
    },

    async synthesize(projectId) {
      if (!projects.get(projectId)) throw new ProjectNotFoundError(projectId);
      const bs = buckets(projectId);
      // Opening the synthesise action IS the "review opened" event (T-D22) — record it
      // even when no AI key is configured so due/last-reviewed still advance.
      const context = bs
        .map((b) => `## ${b.label} (${b.count})\n` + b.entries.map((e) => `- ${e.detail}`).join('\n'))
        .join('\n\n');
      let answer: string | null = null;
      let usedAi = false;
      if (anthropic.available()) {
        try {
          const res = await anthropic.call({
            model: REVIEW_MODEL,
            system:
              'You are a project-hygiene reviewer. From the hygiene buckets, write a ' +
              'short prioritised list of what to clean up next and why. Be concrete.',
            messages: [{ role: 'user', content: context }],
            max_tokens: REVIEW_MAX_TOKENS,
          });
          if (res.text.trim() !== '') {
            answer = res.text;
            usedAi = true;
          }
          if (res.input_tokens > 0 || res.output_tokens > 0) {
            recordCost(db, {
              projectId,
              feature: 'periodic_review',
              model: REVIEW_MODEL,
              inputTokens: res.input_tokens,
              outputTokens: res.output_tokens,
              usdEstimate: usdEstimate(REVIEW_MODEL, res.input_tokens, res.output_tokens),
            });
          }
        } catch {
          answer = null;
        }
      }
      appendAudit(db, {
        projectId,
        entityType: 'project',
        entityId: projectId,
        actor: usedAi ? 'ai' : 'user',
        field: 'periodic_review_opened',
        newValue: String(bs.reduce((n, b) => n + b.count, 0)),
        triggerContext: {
          used_ai: usedAi,
          ...(usedAi
            ? { model: REVIEW_MODEL, prompt_fingerprint: promptFingerprint('periodic_review', context) }
            : {}),
        },
      });
      return { answer, used_ai: usedAi };
    },
  };
}
