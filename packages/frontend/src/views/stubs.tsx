import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { ModulesResult, Project } from '@throughline/shared';
import { api, type MethodologySummary } from '../api.js';
import { findBundle } from '../hooks/useMethodologies.js';
import { NewProjectModal } from '../components/NewProjectModal.js';

interface StubProps {
  title: string;
  body: string;
}

export function Stub({ title, body }: StubProps) {
  return (
    <div className="view-stub" data-testid="view-stub">
      <h1>{title}</h1>
      <p>{body}</p>
    </div>
  );
}

interface ProjectsViewProps {
  bundles: MethodologySummary[];
  onCreated: (project: Project) => void;
  // Keeps the header switcher / app-level project list in sync after a
  // lifecycle change (archive / unarchive / delete) made from this view.
  onChanged?: () => void | Promise<void>;
}

export function ProjectsView({ bundles, onCreated, onChanged }: ProjectsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  // This view owns the full project lifecycle (SPEC §11: create / switch /
  // archive / delete all functional) and is the single source of truth for its
  // list — it fetches active + archived via reload() on mount and after every
  // action, rather than seeding from a prop the header switcher also drives.
  const [all, setAll] = useState<Project[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await api.listProjects(true);
      setAll(r.projects);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = useCallback(
    async (id: string, op: 'archive' | 'unarchive' | 'delete') => {
      setBusy(id);
      setError(null);
      try {
        if (op === 'delete') await api.deleteProject(id);
        else await api.updateProject(id, { state: op === 'archive' ? 'archived' : 'active' });
        await reload();
        await onChanged?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [reload, onChanged],
  );

  return (
    <div className="view-stub" data-testid="view-projects">
      <div className="projects-toolbar">
        <h1>Projects</h1>
        <button
          type="button"
          className="primary"
          onClick={() => setModalOpen(true)}
          data-testid="new-project-button"
        >
          New project
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert" data-testid="projects-error">
          {error}
        </p>
      )}
      <div className="projects-list">
        {all.map((p) => (
          <article key={p.id} className="project-card" data-testid={`project-card-${p.id}`}>
            <h3>
              {p.name}{' '}
              {p.state === 'archived' && (
                <span className="tag" data-testid={`project-archived-${p.id}`}>
                  archived
                </span>
              )}
            </h3>
            <div className="meta">
              bundle: <code>{p.bundle_id}</code>
            </div>
            <div className="meta">
              repo: <code>{p.repo_path}</code>
            </div>
            <div className="form-actions">
              {p.state === 'archived' ? (
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => void act(p.id, 'unarchive')}
                  data-testid={`project-unarchive-${p.id}`}
                >
                  Unarchive
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => void act(p.id, 'archive')}
                  data-testid={`project-archive-${p.id}`}
                >
                  Archive
                </button>
              )}
              <button
                type="button"
                className="danger"
                disabled={busy === p.id}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete project "${p.name}"? This removes its items, sessions, and history and cannot be undone.`,
                    )
                  )
                    void act(p.id, 'delete');
                }}
                data-testid={`project-delete-${p.id}`}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        {all.length === 0 && (
          <p>No projects yet — click <strong>New project</strong> to create one.</p>
        )}
      </div>
      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(project) => {
          setModalOpen(false);
          onCreated(project);
          void reload();
        }}
        bundles={bundles}
      />
    </div>
  );
}

export function HomeView() {
  const { id: projectId } = useParams();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ scan_id: string; proposal_id: string; match_count: number } | null>(
    null,
  );

  async function runScan() {
    if (!projectId) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const r = await api.scanCodeTodos(projectId);
      setScanResult(r.result);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="view-stub" data-testid="view-home">
      <h1>Home</h1>
      <p>
        Phase 14 fills this with the across-everything surface (recent activity, drift inbox count, scratchpad
        jots). For now it hosts manual capture entry points.
      </p>
      <section className="home-section" aria-label="Code TODO/FIXME import">
        <h2>Code TODO import</h2>
        <p className="form-hint">
          Scans the project's repo for <code>TODO:</code>, <code>FIXME:</code>, <code>XXX:</code> and proposes
          one item per match. Apply via the dump-zone review modal.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="primary"
            onClick={() => void runScan()}
            disabled={scanning || !projectId}
            data-testid="code-todo-scan"
          >
            {scanning ? 'Scanning…' : 'Scan repo for TODOs'}
          </button>
        </div>
        {scanError && (
          <p className="form-error" role="alert">
            {scanError}
          </p>
        )}
        {scanResult && (
          <p className="form-hint" data-testid="code-todo-result">
            Found {scanResult.match_count} match{scanResult.match_count === 1 ? '' : 'es'}; proposal saved as{' '}
            <code>{scanResult.proposal_id.slice(0, 8)}</code>. Open the session view for this project to apply.
          </p>
        )}
      </section>
    </div>
  );
}

export function ModulesView({
  bundles,
  projectBundleId,
}: {
  bundles: MethodologySummary[];
  projectBundleId: string;
}) {
  const { id } = useParams<{ id: string }>();
  const bundle = findBundle(bundles, projectBundleId);
  const hidden = bundle && (bundle.status !== 'loaded' || bundle.has_primary_unit !== true);

  const [result, setResult] = useState<ModulesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hidden || !id) return;
    let cancelled = false;
    api
      .getModules(id)
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load modules.');
      });
    return () => {
      cancelled = true;
    };
  }, [hidden, id]);

  if (hidden) {
    return <Navigate to=".." relative="path" replace />;
  }

  const unitLabel = result?.primary_unit_label ?? 'primary unit';

  return (
    <div className="view-modules" data-testid="view-modules">
      <h1>Modules</h1>
      <p className="muted">
        Items grouped by {unitLabel}, with tier classification, phase indicators, and
        anchor / marker counts (SPEC §7.11).
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {result && result.modules.length === 0 && (
        <p className="muted" data-testid="modules-empty">
          No {unitLabel}s yet — set an item's primary unit in its detail panel to populate this
          view.
        </p>
      )}
      {result && result.modules.length > 0 && (
        <table className="modules-table" data-testid="modules-table">
          <thead>
            <tr>
              <th>{unitLabel}</th>
              <th>tier</th>
              <th>items</th>
              <th>phase(s)</th>
              <th>anchors</th>
              <th>markers</th>
              <th>drift</th>
            </tr>
          </thead>
          <tbody>
            {result.modules.map((m) => (
              <tr key={m.ref} data-testid={`module-row-${m.ref}`}>
                <td>{m.ref}</td>
                <td>
                  <span className="tag" data-testid={`module-tier-${m.ref}`}>
                    {m.tier}
                  </span>
                </td>
                <td>{m.item_count}</td>
                <td>{m.phases.length > 0 ? m.phases.join(', ') : '—'}</td>
                <td>{m.anchor_count}</td>
                <td>{m.marker_count}</td>
                <td>
                  {m.drift_signal_count > 0 ? (
                    <span
                      className="drift-badge"
                      title="Discipline drift (SPEC §7.14)"
                      data-testid={`module-drift-${m.ref}`}
                    >
                      ⚠ {m.drift_signal_count}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function GraphView() {
  return (
    <Stub
      title="Graph"
      body="Cytoscape-rendered node/edge graph lands after items + sessions (Phase 3). Communication-model edges arrive with the SiteMesh bundle (Phase 7). Phase 2 ships the route as an empty stub."
    />
  );
}

