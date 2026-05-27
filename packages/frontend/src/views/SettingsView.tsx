import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BackupStatus,
  CommunicationModelView,
  CostSummary,
  OrphanedRule,
  Project,
  SecretsPresenceResult,
} from '@throughline/shared';
import { api, type MethodologySummary } from '../api.js';
import { useProjects } from '../hooks/useProjects.js';
import { useMethodologies } from '../hooks/useMethodologies.js';

// Phase 15 — settings panel (SPEC §7.25, CODE_SPEC §19). Covers every knob: secrets
// (write-only, T-D4), backup (T-D28), cost meter threshold (T-D29), the global hygiene
// intervals, per-project repo/bundle/GitHub binding, the OS-notification grant, and the
// orphaned-rules panel (T-D33). Per-feature model overrides persist here; their
// consumption across AI factories is a documented Phase-16 follow-up.

const MODEL_OPTIONS = [
  { value: 'haiku', label: 'Haiku (fast, cheap)' },
  { value: 'sonnet', label: 'Sonnet (default)' },
  { value: 'opus', label: 'Opus (most capable)' },
];

// CODE_SPEC §14 per-feature defaults — the override keys the panel exposes.
const FEATURE_OVERRIDES = [
  'dump_zone',
  'reconcile',
  'chat',
  'retro',
  'rag_text',
  'code_qa',
  'dedup',
  'drift_reverify',
  'tag_suggestion',
  'stakeholder',
  'mermaid',
  'verifier_rule',
  'companion',
  'session_start',
];

function numOrEmpty(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function strOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

// Theme switcher (UI redesign Slice 4). Persists theme_direction / theme_mode /
// theme_density via the settings store. The backend broadcasts a
// `settings-changed` SSE event on write; App applies the body data-* attributes
// live, so a change here hot-reloads every open tab without a refresh.
function AppearanceSection({
  settings,
  onSaveSettings,
}: {
  settings: Record<string, unknown>;
  onSaveSettings: (patch: Record<string, unknown>) => void;
}) {
  const direction = strOr(settings['theme_direction'], 'A');
  const mode = strOr(settings['theme_mode'], 'dark');
  const density = strOr(settings['theme_density'], 'comfortable');
  return (
    <Section title="Appearance">
      <p className="settings-hint">
        Changes apply live to every open tab (no refresh).
      </p>
      <label className="settings-row">
        <span>Direction</span>
        <select
          data-testid="theme-direction"
          value={direction}
          onChange={(e) => onSaveSettings({ theme_direction: e.target.value })}
        >
          <option value="A">A · Quiet Rigor</option>
          <option value="B">B · Editorial Spec</option>
          <option value="C">C · Terminal Atelier</option>
        </select>
      </label>
      <label className="settings-row">
        <span>Mode</span>
        <select
          data-testid="theme-mode"
          value={mode}
          onChange={(e) => onSaveSettings({ theme_mode: e.target.value })}
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>
      <label className="settings-row">
        <span>Density</span>
        <select
          data-testid="theme-density"
          value={density}
          onChange={(e) => onSaveSettings({ theme_density: e.target.value })}
        >
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
      </label>
    </Section>
  );
}

export function SettingsView() {
  const { projects, refresh: refreshProjects } = useProjects();
  const { bundles } = useMethodologies();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [secrets, setSecrets] = useState<SecretsPresenceResult | null>(null);
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [cost, setCost] = useState<CostSummary | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void api.getSettings().then((r) => setSettings(r.settings));
    void api.getSecrets().then(setSecrets).catch(() => {});
    void api.getBackupStatus().then(setBackup).catch(() => {});
    void api
      .getCostSummary({ scope: 'global' })
      .then(setCost)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = useCallback(
    async (patch: Record<string, unknown>) => {
      setError(null);
      try {
        const r = await api.updateSettings(patch);
        setSettings(r.settings);
        setMsg('Saved');
        setTimeout(() => setMsg(null), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  return (
    <div className="settings-view" data-testid="settings-view">
      <h1>Settings</h1>
      {msg && <p className="settings-msg" role="status">{msg}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <AppearanceSection settings={settings} onSaveSettings={saveSettings} />

      <SecretsSection presence={secrets} onSaved={setSecrets} />

      <BackupSection
        backup={backup}
        settings={settings}
        onSaveSettings={saveSettings}
        onRefresh={load}
        onError={setError}
      />

      <Section title="Cost meter (T-D29)">
        <p className="settings-hint">
          {cost
            ? `Global spend — today $${cost.day.usd_estimate.toFixed(
                2,
              )}, week $${cost.week.usd_estimate.toFixed(
                2,
              )}, month $${cost.month.usd_estimate.toFixed(2)}.`
            : 'Loading current spend…'}
        </p>
        <NumberSetting
          label="Daily threshold warning (USD) — leave blank for no threshold"
          value={numOrEmpty(settings['cost_daily_threshold_usd'])}
          onSave={(v) =>
            saveSettings({ cost_daily_threshold_usd: v === '' ? null : Number(v) })
          }
          testid="cost-threshold"
          allowEmpty
        />
      </Section>

      <Section title="Hygiene intervals">
        <NumberSetting
          label="Stale-item threshold (days)"
          value={numOrEmpty(settings['stale_threshold_days'])}
          onSave={(v) => saveSettings({ stale_threshold_days: Number(v) })}
          testid="stale-threshold"
        />
        <NumberSetting
          label="Periodic-review interval (days)"
          value={numOrEmpty(settings['periodic_review_interval_days'])}
          onSave={(v) => saveSettings({ periodic_review_interval_days: Number(v) })}
          testid="periodic-interval"
        />
        <NumberSetting
          label="Claude Code processed-archive retention (days)"
          value={numOrEmpty(settings['archive_retention_days'])}
          onSave={(v) => saveSettings({ archive_retention_days: Number(v) })}
          testid="archive-retention"
        />
      </Section>

      <ModelSection settings={settings} onSaveSettings={saveSettings} />

      <NotificationsSection
        enabled={settings['os_notifications_enabled'] === true}
        onError={setError}
        onChanged={load}
      />

      <ProjectSection
        projects={projects}
        bundles={bundles}
        onSaved={refreshProjects}
        onError={setError}
      />

      <CommunicationModelSection projects={projects} onError={setError} />

      <OrphanRulesSection projects={projects} onError={setError} />
    </div>
  );
}

function SecretsSection({
  presence,
  onSaved,
}: {
  presence: SecretsPresenceResult | null;
  onSaved: (p: SecretsPresenceResult) => void;
}) {
  const [anthropic, setAnthropic] = useState('');
  const [pat, setPat] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const patch: Record<string, string> = {};
      if (anthropic.length > 0) patch.anthropic_api_key = anthropic;
      if (pat.length > 0) patch.github_pat = pat;
      const r = await api.updateSecrets(patch);
      onSaved(r);
      setAnthropic('');
      setPat('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="API keys (T-D4 — stored backend-side, never shown again)">
      {err && <p className="error">{err}</p>}
      <label className="settings-row">
        <span>
          Anthropic API key{' '}
          <em>{presence?.anthropic_api_key ? '· set' : '· not set'}</em>
        </span>
        <input
          type="password"
          value={anthropic}
          placeholder={presence?.anthropic_api_key ? '•••••••• (leave blank to keep)' : 'sk-ant-…'}
          onChange={(e) => setAnthropic(e.target.value)}
          data-testid="secret-anthropic"
        />
      </label>
      <label className="settings-row">
        <span>
          GitHub PAT <em>{presence?.github_pat ? '· set' : '· not set'}</em>
        </span>
        <input
          type="password"
          value={pat}
          placeholder={presence?.github_pat ? '•••••••• (leave blank to keep)' : 'ghp_…'}
          onChange={(e) => setPat(e.target.value)}
          data-testid="secret-pat"
        />
      </label>
      <button type="button" onClick={save} disabled={busy} data-testid="save-secrets">
        Save keys
      </button>
    </Section>
  );
}

function BackupSection({
  backup,
  settings,
  onSaveSettings,
  onRefresh,
  onError,
}: {
  backup: BackupStatus | null;
  settings: Record<string, unknown>;
  onSaveSettings: (patch: Record<string, unknown>) => Promise<void>;
  onRefresh: () => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const target =
    typeof settings['auto_copy_target_path'] === 'string'
      ? (settings['auto_copy_target_path'] as string)
      : '';

  const doExport = async () => {
    setBusy(true);
    try {
      await api.exportBackup();
      onRefresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Backup (T-D28)">
      <p className="settings-hint" data-testid="backup-status">
        {backup
          ? backup.last_backup_at
            ? `Last backup: ${new Date(backup.last_backup_at).toLocaleString()}${
                backup.stale ? ` — older than ${backup.threshold_days} days` : ''
              }`
            : 'No backup taken yet.'
          : 'Loading…'}
      </p>
      <button type="button" onClick={doExport} disabled={busy} data-testid="export-backup">
        Export datastore snapshot now
      </button>

      {!target && (
        <p className="settings-warning" role="alert" data-testid="autocopy-warning">
          ⚠ No auto-copy target is set. Snapshots stay on this machine only — a disk loss
          or laptop wipe loses everything. Set an off-disk path (external drive, synced
          folder, network share) below for real backup.
        </p>
      )}
      <TextSetting
        label="Auto-copy target path (off-disk — strongly recommended)"
        value={target}
        placeholder="/Volumes/Backup/throughline.sqlite"
        onSave={(v) => onSaveSettings({ auto_copy_target_path: v === '' ? null : v })}
        testid="autocopy-target"
        allowEmpty
      />
      <NumberSetting
        label="Header turns red after N days without a backup"
        value={numOrEmpty(settings['backup_threshold_days'])}
        onSave={(v) => onSaveSettings({ backup_threshold_days: Number(v) })}
        testid="backup-threshold"
      />
      <NumberSetting
        label="Auto-copy interval (days)"
        value={numOrEmpty(settings['backup_nudge_interval_days'])}
        onSave={(v) => onSaveSettings({ backup_nudge_interval_days: Number(v) })}
        testid="backup-interval"
      />
    </Section>
  );
}

function ModelSection({
  settings,
  onSaveSettings,
}: {
  settings: Record<string, unknown>;
  onSaveSettings: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const def = typeof settings['default_model'] === 'string' ? (settings['default_model'] as string) : 'sonnet';
  return (
    <Section title="Models">
      <label className="settings-row">
        <span>Default model</span>
        <select
          value={def}
          onChange={(e) => onSaveSettings({ default_model: e.target.value })}
          data-testid="default-model"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>Per-feature overrides</summary>
        <p className="settings-hint">
          Blank uses the per-feature default from SPEC §9. The global default model
          applies to Sonnet-tier features; features that are Haiku by design stay Haiku
          unless overridden here.
        </p>
        {FEATURE_OVERRIDES.map((f) => {
          const key = `model_override_${f}`;
          const cur = typeof settings[key] === 'string' ? (settings[key] as string) : '';
          return (
            <label className="settings-row" key={f}>
              <span>{f}</span>
              <select
                value={cur}
                onChange={(e) =>
                  onSaveSettings({ [key]: e.target.value === '' ? null : e.target.value })
                }
                data-testid={`override-${f}`}
              >
                <option value="">(default)</option>
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </details>
    </Section>
  );
}

function NotificationsSection({
  enabled,
  onError,
  onChanged,
}: {
  enabled: boolean;
  onError: (m: string) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const grant = async () => {
    setBusy(true);
    try {
      await api.testNotification();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="OS notifications">
      <p className="settings-hint">
        {enabled
          ? 'OS notifications enabled. Click again to re-test delivery.'
          : 'Grant permission by firing a test notification — your OS will prompt the first time.'}
      </p>
      <button type="button" onClick={grant} disabled={busy} data-testid="grant-notifications">
        {enabled ? 'Send test notification' : 'Grant / test OS notifications'}
      </button>
    </Section>
  );
}

function ProjectSection({
  projects,
  bundles,
  onSaved,
  onError,
}: {
  projects: Project[];
  bundles: MethodologySummary[];
  onSaved: () => Promise<void> | void;
  onError: (m: string) => void;
}) {
  const [sel, setSel] = useState('');
  const project = projects.find((p) => p.id === sel) ?? null;
  const [repoPath, setRepoPath] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [bundlePath, setBundlePath] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (project) {
      setRepoPath(project.repo_path);
      setBundleId(project.bundle_id);
      setBundlePath(project.bundle_path ?? '');
      setOwner(project.github_owner ?? '');
      setRepo(project.github_repo ?? '');
    }
  }, [project]);

  const save = async () => {
    if (!project) return;
    setBusy(true);
    try {
      await api.updateProject(project.id, {
        repo_path: repoPath,
        bundle_id: bundleId,
        bundle_path: bundlePath === '' ? null : bundlePath,
        github_owner: owner === '' ? null : owner,
        github_repo: repo === '' ? null : repo,
      });
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Per-project binding (SPEC §7.25)">
      <label className="settings-row">
        <span>Project</span>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          data-testid="project-select"
        >
          <option value="">— choose —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {project && (
        <>
          <label className="settings-row">
            <span>Local repo path</span>
            <input
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              data-testid="project-repo-path"
            />
          </label>
          <label className="settings-row">
            <span>Methodology bundle</span>
            <select
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value)}
              data-testid="project-bundle"
            >
              {bundles.map((b) => (
                <option key={b.bundle_id} value={b.bundle_id}>
                  {b.bundle_id}
                  {b.status === 'error' ? ' (error)' : ''}
                </option>
              ))}
              {!bundles.find((b) => b.bundle_id === bundleId) && (
                <option value={bundleId}>{bundleId}</option>
              )}
            </select>
          </label>
          <label className="settings-row">
            <span>Bundle path (optional)</span>
            <input
              value={bundlePath}
              onChange={(e) => setBundlePath(e.target.value)}
              placeholder="/absolute/path/to/external/bundle-dir"
              data-testid="project-bundle-path"
            />
          </label>
          <label className="settings-row">
            <span>GitHub owner</span>
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              data-testid="project-owner"
            />
          </label>
          <label className="settings-row">
            <span>GitHub repo</span>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              data-testid="project-repo"
            />
          </label>
          <ThroughlineStatusBlock project={project} />
          <p className="settings-hint">
            Per-session branch fields are set on each session in the Sessions view.
          </p>
          <button type="button" onClick={save} disabled={busy} data-testid="save-project">
            Save project binding
          </button>
        </>
      )}
    </Section>
  );
}

// C-D19 surface 6 — clone-and-go config status. Surfaces whether the project's
// repo has a `.throughline/` directory and whether `.throughline/project.json`
// is present and valid. `throughline_status` is computed by the backend at
// request time; absent on pre-Phase-19 responses (legacy callers).
function ThroughlineStatusBlock({ project }: { project: Project }) {
  const status = project.throughline_status;
  if (status === undefined) return null;
  const labels: Record<NonNullable<Project['throughline_status']>, { headline: string; detail: string }> = {
    absent: {
      headline: 'No `.throughline/` directory found in this repo.',
      detail:
        'Clone-and-go config is not set up. Run `throughline init` from the repo root to create `.throughline/project.json`.',
    },
    partial: {
      headline: '`.throughline/` directory present but config missing or invalid.',
      detail:
        '`.throughline/project.json` is absent or failed to parse. Run `throughline init` to (re-)write it, or fix it by hand.',
    },
    complete: {
      headline: '`.throughline/project.json` present and valid.',
      detail:
        'Run `throughline init` again any time to re-apply file values to this binding (items, sessions, and audit history are never touched).',
    },
  };
  const { headline, detail } = labels[status];
  return (
    <div
      className="settings-throughline-status"
      data-testid="throughline-status"
      data-status={status}
    >
      <p className="settings-hint" style={{ marginBottom: 4 }}>
        <strong>Clone-and-go config:</strong> {headline}
      </p>
      <p className="settings-hint" style={{ marginTop: 0 }}>{detail}</p>
    </div>
  );
}

// Phase 18 Slice 2 — per-project Communication-model settings.
//
// The bundle's §6 (T-D49) declares edge types and the tier vocabulary; this UI
// supplies the per-project pieces the bundle leaves open:
//   • a path on disk for each edge type whose §6 declaration carries
//     `contract_source:` (only those surface, per confirmation 5);
//   • an architectural-tier assignment for each item-derived module
//     (= C-D13 modules), chosen from the bundle's `tiers:` vocabulary.
//
// Phase 18 ships parse-and-render only — nothing reads the configured paths yet.
// Inputs persist via `PUT /api/projects/:id/communication-model`.
function CommunicationModelSection({
  projects,
  onError,
}: {
  projects: Project[];
  onError: (m: string) => void;
}) {
  const [sel, setSel] = useState('');
  const [view, setView] = useState<CommunicationModelView | null>(null);
  const [busy, setBusy] = useState(false);

  // `viewRef` always points at the freshest view so `save()` reads from a live
  // value, not a closure capture. The earlier fix made `load()` awaitable and
  // gated input on `busy`; both still hold. The ref closes the structural risk
  // Gitar flagged: removing or weakening the busy-gate later would no longer
  // silently re-introduce stale-write races (PR #31 Slice 3 fix-round 1).
  const viewRef = useRef<CommunicationModelView | null>(null);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Returns the load promise so `save()` can await the post-write reload before
  // releasing `busy`. Fire-and-forget would race the next save (Slice 2 review).
  const load = useCallback(
    async (projectId: string) => {
      if (!projectId) {
        setView(null);
        return;
      }
      try {
        const v = await api.getCommunicationModel(projectId);
        setView(v);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    },
    [onError],
  );

  useEffect(() => {
    void load(sel);
  }, [sel, load]);

  // Patch shape: one of two single-field updates per click. `save()` merges the
  // patch against the freshest stored maps from `viewRef` (never against the
  // render-time `view` closure).
  type SavePatch =
    | { kind: 'contract_source'; edgeName: string; value: string }
    | { kind: 'module_tier'; moduleName: string; tier: string };

  const save = async (patch: SavePatch) => {
    if (!sel) return;
    const current = viewRef.current;
    if (!current) return;
    setBusy(true);
    try {
      const next = {
        contract_sources:
          patch.kind === 'contract_source'
            ? { ...current.contract_sources, [patch.edgeName]: patch.value }
            : current.contract_sources,
        module_tiers:
          patch.kind === 'module_tier'
            ? { ...current.module_tiers, [patch.moduleName]: patch.tier }
            : current.module_tiers,
      };
      await api.updateCommunicationModel(sel, next);
      await load(sel);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const contractEntries = view ? Object.entries(view.resolved.contract_sources) : [];
  const moduleEntries = view ? Object.entries(view.resolved.module_tiers) : [];
  const tierOptions = view?.resolved.declared_tiers ?? [];

  return (
    <Section title="Communication model (T-D49 — per project)">
      <p className="settings-hint">
        Configured paths and module-tier assignments are <strong>not yet consumed</strong> —
        Phase 18 ships parse-and-render only. They persist now so later phases can read them.
      </p>
      <label className="settings-row">
        <span>Project</span>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          data-testid="comm-project-select"
        >
          <option value="">— choose —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {sel && view && view.bundle.status === 'none' && (
        <p className="settings-hint" data-testid="comm-bundle-none">
          This project's bundle declares no communication model (§6 = none). Nothing to configure.
        </p>
      )}

      {sel && view && view.bundle.status === 'declared' && (
        <>
          <h3>Contract sources</h3>
          {contractEntries.length === 0 ? (
            <p className="settings-hint" data-testid="comm-no-contract-sources">
              No edge types in this bundle declare a <code>contract_source:</code>.
            </p>
          ) : (
            <ul className="settings-list" data-testid="comm-contract-sources">
              {contractEntries.map(([edgeName, { absolute_path, configured }]) => (
                <li key={edgeName} className="settings-row" data-testid={`comm-cs-${edgeName}`}>
                  <span>
                    <code>{edgeName}</code>
                    {configured ? (
                      <em className="settings-hint"> · resolves to {absolute_path}</em>
                    ) : (
                      <em className="settings-hint"> · not configured</em>
                    )}
                  </span>
                  <ContractSourceInput
                    initial={view.contract_sources[edgeName] ?? ''}
                    busy={busy}
                    onSave={(value) => save({ kind: 'contract_source', edgeName, value })}
                    testid={`comm-cs-input-${edgeName}`}
                  />
                </li>
              ))}
            </ul>
          )}

          <h3>Module tiers</h3>
          {moduleEntries.length === 0 ? (
            <p className="settings-hint" data-testid="comm-no-modules">
              No modules to assign yet — modules appear once items carry primary-unit references.
            </p>
          ) : (
            <ul className="settings-list" data-testid="comm-module-tiers">
              {moduleEntries.map(([moduleName, { tier, valid }]) => (
                <li key={moduleName} className="settings-row" data-testid={`comm-mt-${moduleName}`}>
                  <span>
                    <code>{moduleName}</code>
                    {tier === null ? (
                      <em className="settings-hint"> · unassigned</em>
                    ) : valid ? null : (
                      <em className="settings-hint settings-warning">
                        {' '}
                        · tier "{tier}" is not declared in §2
                      </em>
                    )}
                  </span>
                  <select
                    value={tier ?? ''}
                    disabled={busy}
                    onChange={(e) =>
                      save({ kind: 'module_tier', moduleName, tier: e.target.value })
                    }
                    data-testid={`comm-mt-select-${moduleName}`}
                  >
                    <option value="">— unassigned —</option>
                    {tierOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}

// Per-edge-type path input. Local state so the user can type without each
// keystroke round-tripping; `Save` flushes back through the section's save().
function ContractSourceInput({
  initial,
  busy,
  onSave,
  testid,
}: {
  initial: string;
  busy: boolean;
  onSave: (value: string) => void;
  testid: string;
}) {
  const [v, setV] = useState(initial);
  useEffect(() => setV(initial), [initial]);
  return (
    <span className="settings-inline">
      <input
        value={v}
        placeholder="docs/contracts/<edge-source>"
        onChange={(e) => setV(e.target.value)}
        disabled={busy}
        data-testid={testid}
      />
      <button
        type="button"
        onClick={() => onSave(v)}
        disabled={busy}
        data-testid={`${testid}-save`}
      >
        Save
      </button>
    </span>
  );
}

function OrphanRulesSection({
  projects,
  onError,
}: {
  projects: Project[];
  onError: (m: string) => void;
}) {
  const [sel, setSel] = useState('');
  const [rules, setRules] = useState<OrphanedRule[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    (projectId: string) => {
      if (!projectId) {
        setRules([]);
        return;
      }
      void api
        .listOrphanRules(projectId)
        .then((r) => setRules(r.rules))
        .catch((e) => onError(e instanceof Error ? e.message : String(e)));
    },
    [onError],
  );

  useEffect(() => {
    load(sel);
  }, [sel, load]);

  const dismiss = async (rid: string) => {
    setBusy(true);
    try {
      await api.dismissOrphanRule(sel, rid);
      load(sel);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const draftPr = async (rid: string) => {
    setBusy(true);
    try {
      const r = await api.draftOrphanCleanupPr(sel, rid);
      window.open(r.pr_url, '_blank', 'noopener');
      load(sel);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Orphaned verifier rules (T-D33)">
      <label className="settings-row">
        <span>Project</span>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          data-testid="orphan-project-select"
        >
          <option value="">— choose —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {sel && rules.length === 0 && (
        <p className="settings-hint" data-testid="orphan-empty">
          No orphaned rules. (Rule files are never auto-removed — deleting an item only
          flags them here.)
        </p>
      )}
      <ul className="orphan-list">
        {rules.map((r) => (
          <li key={r.id} data-testid="orphan-row">
            <code>{r.rule_path}</code>
            <span className="settings-hint"> (from deleted item {r.original_item_id})</span>
            <button type="button" onClick={() => draftPr(r.id)} disabled={busy}>
              Draft cleanup PR
            </button>
            <button type="button" onClick={() => dismiss(r.id)} disabled={busy}>
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TextSetting({
  label,
  value,
  placeholder,
  onSave,
  testid,
  allowEmpty,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
  testid: string;
  allowEmpty?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="settings-row">
      <span>{label}</span>
      <span className="settings-inline">
        <input
          value={v}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          data-testid={testid}
        />
        <button
          type="button"
          onClick={() => onSave(v)}
          disabled={!allowEmpty && v.trim() === ''}
          data-testid={`${testid}-save`}
        >
          Save
        </button>
      </span>
    </label>
  );
}

function NumberSetting({
  label,
  value,
  onSave,
  testid,
  allowEmpty,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  testid: string;
  allowEmpty?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const invalid = v !== '' && !(Number.isFinite(Number(v)) && Number(v) >= 0);
  return (
    <label className="settings-row">
      <span>{label}</span>
      <span className="settings-inline">
        <input
          type="number"
          min={0}
          value={v}
          onChange={(e) => setV(e.target.value)}
          data-testid={testid}
        />
        <button
          type="button"
          onClick={() => onSave(v)}
          disabled={invalid || (!allowEmpty && v === '')}
          data-testid={`${testid}-save`}
        >
          Save
        </button>
      </span>
    </label>
  );
}
