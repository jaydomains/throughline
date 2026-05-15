import { useEffect, useState } from 'react';
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
  projects: Project[];
  bundles: MethodologySummary[];
  onCreated: (project: Project) => void;
}

export function ProjectsView({ projects, bundles, onCreated }: ProjectsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
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
      <p>
        Phase 2 lists projects in the header switcher. Phase 3 fills this view with create / archive
        / delete actions and per-project state at a glance.
      </p>
      <div className="projects-list">
        {projects.map((p) => (
          <article key={p.id} className="project-card">
            <h3>{p.name}</h3>
            <div className="meta">
              bundle: <code>{p.bundle_id}</code>
            </div>
            <div className="meta">
              repo: <code>{p.repo_path}</code>
            </div>
          </article>
        ))}
        {projects.length === 0 && (
          <p>No projects yet — click <strong>New project</strong> to create one.</p>
        )}
      </div>
      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(project) => {
          setModalOpen(false);
          onCreated(project);
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

export function GatesView({
  bundles,
  projectBundleId,
}: {
  bundles: MethodologySummary[];
  projectBundleId: string;
}) {
  const bundle = findBundle(bundles, projectBundleId);
  if (bundle && (bundle.status !== 'loaded' || bundle.has_gates !== true)) {
    return <Navigate to=".." relative="path" replace />;
  }
  return (
    <Stub
      title="Methodology gates"
      body="The methodology gate runtime lands in Phase 8 with five phase moments and multi-gate dispatch. Phase 2 ships the route as an empty stub."
    />
  );
}
