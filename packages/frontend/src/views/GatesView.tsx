import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type {
  ChecklistRun,
  ChecklistRunStep,
  CompanionChecklistsResult,
  SessionStartModesResult,
  SessionStartPromptResult,
  DisciplineDriftResult,
  GateFiring,
  GateFiringsResult,
} from '@throughline/shared';
import { api, type MethodologySummary } from '../api.js';
import { findBundle } from '../hooks/useMethodologies.js';

// Phase 8 — methodology-gates view (SPEC §7.11/§7.12, C-D6). Gate failures surface as
// proposals; never repo blocks (T-D44). Hidden for freeform-bound projects (no gates).

const TRIGGERABLE: ReadonlySet<string> = new Set(['pre-write', 'pr-open']);

function statusClass(s: GateFiring['status']): string {
  return `gate-status gate-status-${s}`;
}

export function GatesView({
  bundles,
  projectBundleId,
}: {
  bundles: MethodologySummary[];
  projectBundleId: string;
}) {
  const { id } = useParams<{ id: string }>();
  const bundle = findBundle(bundles, projectBundleId);
  const hidden = bundle && (bundle.status !== 'loaded' || bundle.has_gates !== true);

  const [result, setResult] = useState<GateFiringsResult | null>(null);
  const [drift, setDrift] = useState<DisciplineDriftResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);

  const refresh = useCallback(() => {
    if (!id) return;
    api
      .listGateFirings(id)
      .then(setResult)
      .catch(() => setError('Failed to load gate firings.'));
    api
      .getDisciplineDrift(id)
      .then(setDrift)
      .catch(() => setError('Failed to load discipline drift.'));
  }, [id]);

  const rescanDrift = async () => {
    if (!id) return;
    setRescanning(true);
    setError(null);
    try {
      setDrift(await api.rescanDisciplineDrift(id));
    } catch {
      setError('Discipline-drift re-scan failed.');
    } finally {
      setRescanning(false);
    }
  };

  useEffect(() => {
    if (hidden || !id) return;
    refresh();
  }, [hidden, id, refresh]);

  if (hidden) return <Navigate to=".." relative="path" replace />;

  const runMoment = async (moment: string) => {
    if (!id) return;
    setBusy(moment);
    setError(null);
    try {
      await api.runGateMoment(id, moment);
      refresh();
    } catch {
      setError(`Failed to run ${moment} gates.`);
    } finally {
      setBusy(null);
    }
  };

  const override = async (firing: GateFiring) => {
    if (!id) return;
    const reason = window.prompt(`Override "${firing.gate_id}" — reason (audit-logged):`);
    if (!reason || reason.trim().length === 0) return;
    try {
      await api.overrideGateFiring(id, firing.id, reason.trim());
      refresh();
    } catch {
      setError('Override failed.');
    }
  };

  const groups = result?.groups ?? [];

  return (
    <div className="view-gates" data-testid="view-gates">
      <h1>Methodology gates</h1>
      <p className="muted">
        Bundle-declared gates per phase moment. Failures are proposals — Throughline never
        blocks the repo (T-D44). Override with reason or fix and retry.
      </p>
      <div className="gates-actions">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runMoment('pre-write')}
          data-testid="run-pre-write"
        >
          Run pre-write checks
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {groups.length === 0 && (
        <p className="muted" data-testid="gates-empty">
          No gate firings yet. Trigger a moment (or commit in the repo) to populate this view.
        </p>
      )}
      {groups.map((group) => (
        <section
          key={group.moment}
          className="gate-moment"
          data-testid={`gate-moment-${group.moment}`}
        >
          <div className="gate-moment-head">
            <h2>{group.moment}</h2>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runMoment(group.moment)}
              data-testid={`retry-${group.moment}`}
            >
              {TRIGGERABLE.has(group.moment) ? 'Run' : 'Fix and retry'}
            </button>
          </div>
          {group.firings.length === 0 && (
            <p className="muted">No firings recorded for this moment yet.</p>
          )}
          {group.firings.map((f) => (
            <div
              key={f.id}
              className="gate-firing"
              data-testid={`gate-firing-${f.gate_id}`}
            >
              <div className="gate-firing-head">
                <span className={statusClass(f.status)} data-testid={`gate-status-${f.gate_id}`}>
                  {f.findings.override ? 'overridden' : f.status}
                </span>
                <strong>{f.gate_id}</strong>
                <span className="muted">{f.findings.check}</span>
              </div>
              <p className="gate-summary">{f.findings.summary}</p>
              {f.findings.items.length > 0 && (
                <ul className="gate-findings">
                  {f.findings.items.map((it, i) => (
                    <li key={i}>
                      {it.message}
                      {it.ref ? <span className="muted"> — {it.ref}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {f.findings.override ? (
                <p className="muted gate-override">
                  Overridden: {f.findings.override.reason}
                </p>
              ) : (
                (f.status === 'fail' || f.status === 'error') && (
                  <button
                    type="button"
                    className="gate-override-btn"
                    onClick={() => override(f)}
                    data-testid={`override-${f.gate_id}`}
                  >
                    Override with reason
                  </button>
                )
              )}
            </div>
          ))}
        </section>
      ))}

      <section className="discipline-drift" data-testid="discipline-drift">
        <div className="gate-moment-head">
          <h2>Discipline drift</h2>
          <button
            type="button"
            disabled={rescanning}
            onClick={() => void rescanDrift()}
            data-testid="discipline-drift-rescan"
          >
            {rescanning ? 'Re-scanning…' : 'Re-scan'}
          </button>
        </div>
        <p className="muted">
          Bundle-declared discipline-drift categories (SPEC §7.14). Signals are advisory —
          they badge primary units and affected items but never block the repo (T-D44).
        </p>
        {(!drift || drift.groups.length === 0) && (
          <p className="muted" data-testid="discipline-drift-empty">
            No discipline drift detected.
          </p>
        )}
        {drift?.groups.map((g) => (
          <div
            key={g.category}
            className="drift-category"
            data-testid={`drift-category-${g.category}`}
          >
            <h3>
              {g.category} <span className="muted">({g.signals.length})</span>
            </h3>
            <ul className="gate-findings">
              {g.signals.map((s) => (
                <li key={s.id} data-testid={`drift-signal-${s.id}`}>
                  {s.reason}
                  {s.item_id ? <span className="muted"> — item {s.item_id}</span> : null}
                  {s.primary_unit_ref ? (
                    <span className="muted"> — unit {s.primary_unit_ref}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <CompanionReview projectId={id} />
      <SessionStart projectId={id} />
    </div>
  );
}

// Phase 12 — companion review runtime (SPEC §7.18, C-D8, T-D45). Bundle-declared review
// checklists run as a structured workflow on this same methodology surface (gates and
// review patterns share UI vocabulary — rows of state, override/retry actions). Hidden
// when the bundle declares no checklists.
function stepStateClass(s: ChecklistRunStep['state']): string {
  return `gate-status gate-status-${s === 'passed' ? 'pass' : s === 'failed' ? 'fail' : s === 'skipped' ? 'skipped' : 'error'}`;
}

function CompanionReview({ projectId }: { projectId: string | undefined }) {
  const [catalogue, setCatalogue] = useState<CompanionChecklistsResult | null>(null);
  const [runs, setRuns] = useState<ChecklistRun[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickChecklist, setPickChecklist] = useState('');
  const [pickMode, setPickMode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!projectId) return;
    api
      .listCompanionChecklists(projectId)
      .then(setCatalogue)
      .catch(() => setError('Failed to load review checklists.'));
    api
      .listCompanionRuns(projectId)
      .then((r) => setRuns(r.runs))
      .catch(() => setError('Failed to load review runs.'));
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!projectId) return null;
  if (catalogue && catalogue.checklists.length === 0) return null;

  const active = runs.find((r) => r.id === activeId) ?? null;
  const apply = (p: Promise<{ run: ChecklistRun }>) => {
    setBusy(true);
    setError(null);
    p.then(({ run }) => {
      setRuns((prev) => {
        const rest = prev.filter((r) => r.id !== run.id);
        return [run, ...rest];
      });
      setActiveId(run.id);
    })
      .catch(() => setError('Action failed.'))
      .finally(() => setBusy(false));
  };

  const start = () => {
    const checklistId = pickChecklist || catalogue?.checklists[0]?.id;
    if (!checklistId) return;
    apply(api.startCompanionRun(projectId, checklistId, pickMode || null));
  };

  const recordJudgement = (step: ChecklistRunStep) => {
    if (!active) return;
    const raw = window.prompt(
      `Judgement for "${step.step_id}" — type pass, fail, or skip, then a rationale (e.g. "pass: scope matches plan"):`,
    );
    if (!raw) return;
    const m = /^\s*(pass|fail|skip)\s*:?\s*(.*)$/i.exec(raw);
    if (!m) {
      setError('Enter pass, fail, or skip followed by a rationale.');
      return;
    }
    apply(
      api.resolveCompanionJudgement(
        projectId,
        active.id,
        step.step_id,
        m[1]!.toLowerCase() as 'pass' | 'fail' | 'skip',
        m[2]!.trim(),
      ),
    );
  };

  const override = (step: ChecklistRunStep) => {
    if (!active) return;
    const reason = window.prompt(`Override "${step.step_id}" — reason (audit-logged):`);
    if (!reason || reason.trim().length === 0) return;
    apply(api.overrideCompanionStep(projectId, active.id, step.step_id, reason.trim()));
  };

  const complete = () => {
    if (!active) return;
    const summary =
      window.prompt('Optional run-summary note (markdown; leave blank to skip):') ?? '';
    const itemsRaw = summary.trim()
      ? window.prompt('Attach to item ids (comma-separated; leave blank for none):') ?? ''
      : '';
    const itemIds = itemsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    apply(
      api.completeCompanionRun(projectId, active.id, summary.trim() || undefined, itemIds),
    );
  };

  return (
    <section className="companion-review" data-testid="companion-review">
      <div className="gate-moment-head">
        <h2>Companion review</h2>
      </div>
      <p className="muted">
        Bundle-declared review checklists run as a structured workflow (SPEC §7.18, C-D8).
        Mechanical steps execute here; judgement steps take your call or an AI proposal you
        review before committing. Findings are audit-logged; failures never block (T-D44).
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="companion-start gates-actions">
        <select
          value={pickChecklist}
          onChange={(e) => setPickChecklist(e.target.value)}
          data-testid="companion-checklist-pick"
        >
          {catalogue?.checklists.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {catalogue && catalogue.companion_modes.length > 0 && (
          <select
            value={pickMode}
            onChange={(e) => setPickMode(e.target.value)}
            data-testid="companion-mode-pick"
          >
            <option value="">(default mode)</option>
            {catalogue.companion_modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={start}
          data-testid="companion-start"
        >
          Start companion review
        </button>
      </div>

      {runs.length > 0 && (
        <div className="companion-runs gates-actions">
          {runs.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === activeId ? 'companion-run-active' : ''}
              onClick={() => setActiveId(r.id)}
              data-testid={`companion-run-${r.id}`}
            >
              {r.checklist_id} · {r.state}
              {r.companion_mode ? ` · ${r.companion_mode}` : ''}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="companion-run" data-testid="companion-active-run">
          <div className="gate-moment-head">
            <h3>
              {active.checklist_id}{' '}
              <span className="muted">
                ({active.state}
                {active.companion_mode ? ` · ${active.companion_mode}` : ''})
              </span>
            </h3>
            {active.state === 'running' && (
              <button
                type="button"
                disabled={busy}
                onClick={complete}
                data-testid="companion-complete"
              >
                Complete run
              </button>
            )}
          </div>
          {active.summary_entry_id && (
            <p className="muted">Run summary saved as library note {active.summary_entry_id}.</p>
          )}
          {active.steps.map((step) => (
            <div
              key={step.step_id}
              className="gate-firing"
              data-testid={`companion-step-${step.step_id}`}
            >
              <div className="gate-firing-head">
                <span
                  className={stepStateClass(step.state)}
                  data-testid={`companion-step-state-${step.step_id}`}
                >
                  {step.state}
                </span>
                <strong>{step.step_id}</strong>
                <span className="muted">{step.kind}</span>
              </div>
              <p className="gate-summary">{step.description}</p>
              {step.findings.summary && (
                <p className="gate-summary muted">{step.findings.summary}</p>
              )}
              {step.findings.items.length > 0 && (
                <ul className="gate-findings">
                  {step.findings.items.map((it, i) => (
                    <li key={i}>
                      {it.message}
                      {it.ref ? <span className="muted"> — {it.ref}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {step.findings.ai_proposal && (
                <p className="muted">
                  AI proposal ({step.findings.ai_proposal.model}):{' '}
                  {step.findings.ai_proposal.decision} — review and record your call.
                </p>
              )}
              {step.findings.override && (
                <p className="muted gate-override">
                  Overridden: {step.findings.override.reason}
                </p>
              )}
              {active.state === 'running' && (
                <div className="gates-actions">
                  {step.kind === 'mechanical' &&
                    step.state !== 'passed' &&
                    step.state !== 'skipped' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          apply(
                            api.runCompanionMechanicalStep(
                              projectId,
                              active.id,
                              step.step_id,
                            ),
                          )
                        }
                        data-testid={`companion-run-step-${step.step_id}`}
                      >
                        Run check
                      </button>
                    )}
                  {step.kind === 'mechanical' && step.state === 'failed' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => override(step)}
                      data-testid={`companion-override-${step.step_id}`}
                    >
                      Override with reason
                    </button>
                  )}
                  {step.kind === 'judgement' && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          apply(
                            api.aiJudgeCompanionStep(projectId, active.id, step.step_id),
                          )
                        }
                        data-testid={`companion-ai-judge-${step.step_id}`}
                      >
                        Ask AI
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => recordJudgement(step)}
                        data-testid={`companion-judge-${step.step_id}`}
                      >
                        Record judgement
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Phase 13 — session-start scaffolding (SPEC §7.18, §9, C-D9, T-D12). Assembles a
// copy-pasteable session-start prompt for the active project in a bundle-declared
// companion mode. Shares this methodology surface with gates + companion review; a
// freeform-bound project still gets a minimum-spec prompt via the synthetic `default`
// mode, so this panel is always present (uniform with the gates view).
function SessionStart({ projectId }: { projectId: string | undefined }) {
  const [modes, setModes] = useState<SessionStartModesResult | null>(null);
  const [pickMode, setPickMode] = useState('');
  const [result, setResult] = useState<SessionStartPromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    api
      .getSessionStartModes(projectId)
      .then(setModes)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [projectId]);

  const generate = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      setResult(
        await api.generateSessionStartPrompt(projectId, pickMode === '' ? null : pickMode),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [projectId, pickMode]);

  const copy = useCallback(async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.prompt);
    setCopied(true);
  }, [result]);

  if (!projectId) return null;

  return (
    <section className="session-start" data-testid="session-start">
      <div className="gate-moment-head">
        <h2>Session-start prompt</h2>
      </div>
      <p className="muted">
        Assembles project context (decisions, anchors, open markers, cross-unit
        dependencies, include-in-prompt directives) into a copy-pasteable prompt for the
        bundle&apos;s companion mode (SPEC §7.18, C-D9). Relevance is classified with
        Anthropic Haiku; an unchanged context re-serves the cached prompt with no AI call.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="session-start-controls gates-actions">
        {modes && modes.modes.length > 0 && (
          <select
            value={pickMode}
            onChange={(e) => setPickMode(e.target.value)}
            data-testid="session-start-mode-pick"
          >
            <option value="">(default: {modes.default_mode})</option>
            {modes.modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={generate}
          data-testid="session-start-generate"
        >
          Generate prompt
        </button>
      </div>

      {result && (
        <div className="session-start-result" data-testid="session-start-result">
          <div className="gate-moment-head">
            <h3>
              {result.mode}{' '}
              <span className="muted">
                ({result.cached ? 'cached' : 'fresh'}
                {result.classifier_used_ai ? ' · AI-classified' : ' · citation-only'})
              </span>
            </h3>
            <button
              type="button"
              onClick={copy}
              data-testid="session-start-copy"
            >
              {copied ? 'Copied' : 'Copy to clipboard'}
            </button>
          </div>
          <textarea
            className="session-start-prompt"
            readOnly
            value={result.prompt}
            rows={16}
            data-testid="session-start-prompt"
          />
        </div>
      )}
    </section>
  );
}
