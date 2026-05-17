import type {
  CostFeatureBreakdown,
  CostScope,
  CostSummary,
  CostWindow,
} from '@throughline/shared';
import type { DB } from '../db/index.js';
import type { SettingsService } from '../settings/service.js';

// Cost meter (T-D29, CODE_SPEC §11). Reads cost_telemetry rows and rolls them into
// day / week / month windows with a per-feature breakdown. The header pill and the
// settings panel both consume this. The daily threshold defaults to "no threshold"
// (null) — the ROADMAP §13 / CODE_SPEC Q#9 sanctioned build default; no new anchor.
//
// Window semantics: "day" is the current UTC calendar day; "week" and "month" are
// rolling 7-/30-day windows, consistent with the §13-adopted rolling-7d home view.

const KEY_DAILY_THRESHOLD = 'cost_daily_threshold_usd';

interface AggRow {
  feature: string;
  input_tokens: number;
  output_tokens: number;
  usd_estimate: number;
  call_count: number;
}

function emptyWindow(): CostWindow {
  return {
    usd_estimate: 0,
    input_tokens: 0,
    output_tokens: 0,
    call_count: 0,
    by_feature: [],
  };
}

function rollup(rows: AggRow[]): CostWindow {
  const by_feature: CostFeatureBreakdown[] = rows
    .map((r) => ({
      feature: r.feature,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      usd_estimate: r.usd_estimate,
      call_count: r.call_count,
    }))
    .sort((a, b) => b.usd_estimate - a.usd_estimate);
  return {
    usd_estimate: by_feature.reduce((s, f) => s + f.usd_estimate, 0),
    input_tokens: by_feature.reduce((s, f) => s + f.input_tokens, 0),
    output_tokens: by_feature.reduce((s, f) => s + f.output_tokens, 0),
    call_count: by_feature.reduce((s, f) => s + f.call_count, 0),
    by_feature,
  };
}

export interface CostSummaryService {
  summary(opts: { scope: CostScope; projectId: string | null; now?: Date }): CostSummary;
}

export function createCostSummaryService(
  db: DB,
  settings: SettingsService,
): CostSummaryService {
  // Scope filter: 'global' rolls up every project; 'project' filters by project_id
  // (a null project_id means cross-project telemetry, e.g. inbox-processed dumps).
  function aggregate(sinceIso: string, scope: CostScope, projectId: string | null): AggRow[] {
    const params: unknown[] = [sinceIso];
    let scopeClause = '';
    if (scope === 'project') {
      if (projectId === null) {
        scopeClause = ' AND project_id IS NULL';
      } else {
        scopeClause = ' AND project_id = ?';
        params.push(projectId);
      }
    }
    return db
      .prepare(
        `SELECT feature,
                COALESCE(SUM(input_tokens), 0)  AS input_tokens,
                COALESCE(SUM(output_tokens), 0) AS output_tokens,
                COALESCE(SUM(usd_estimate), 0)  AS usd_estimate,
                COUNT(*)                        AS call_count
           FROM cost_telemetry
          WHERE timestamp >= ?${scopeClause}
          GROUP BY feature`,
      )
      .all(...params) as AggRow[];
  }

  return {
    summary({ scope, projectId, now }) {
      const ref = now ?? new Date();
      const dayStart = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()),
      ).toISOString();
      const weekStart = new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(ref.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const dayRows = aggregate(dayStart, scope, projectId);
      const day = dayRows.length ? rollup(dayRows) : emptyWindow();
      const weekRows = aggregate(weekStart, scope, projectId);
      const week = weekRows.length ? rollup(weekRows) : emptyWindow();
      const monthRows = aggregate(monthStart, scope, projectId);
      const month = monthRows.length ? rollup(monthRows) : emptyWindow();

      const thresholdRaw = settings.get(KEY_DAILY_THRESHOLD);
      const daily_threshold_usd =
        typeof thresholdRaw === 'number' && Number.isFinite(thresholdRaw) && thresholdRaw > 0
          ? thresholdRaw
          : null;

      return {
        scope,
        project_id: scope === 'global' ? null : projectId,
        day,
        week,
        month,
        daily_threshold_usd,
        daily_threshold_exceeded:
          daily_threshold_usd !== null && day.usd_estimate > daily_threshold_usd,
      };
    },
  };
}
