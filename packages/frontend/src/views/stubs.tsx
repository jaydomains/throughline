import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { LibraryEntry, Project } from '@throughline/shared';
import { api, type MethodologySummary } from '../api.js';
import { findBundle } from '../hooks/useMethodologies.js';
import { useItemPolicy } from '../hooks/useItemPolicy.js';
import { useSessions } from '../hooks/useSessions.js';
import { NewProjectModal } from '../components/NewProjectModal.js';
import { DumpZone } from '../components/DumpZone.js';

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
  const bundle = findBundle(bundles, projectBundleId);
  if (bundle && (bundle.status !== 'loaded' || bundle.has_primary_unit !== true)) {
    return <Navigate to=".." relative="path" replace />;
  }
  return (
    <Stub
      title="Modules"
      body="Phase 7 brings this alive for SiteMesh-bound projects with primary-unit grouping, tier classification, phase indicators, anchor/marker counts. Phase 2 ships the route as an empty stub."
    />
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

export function LibraryView() {
  const { id: projectId } = useParams();
  const { policy } = useItemPolicy(projectId ?? null);
  const { sessions } = useSessions(projectId ?? null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);

  useEffect(() => {
    if (!projectId) return;
    api
      .listLibrary(projectId)
      .then((r) => setEntries(r.entries))
      .catch(() => {});
  }, [projectId]);

  if (!projectId || !policy) {
    return (
      <Stub
        title="Library"
        body="Notes / prompts / snippets / imported docs land in Phase 6. Phase 4 lands the library dump zone so capture works against the same datastore."
      />
    );
  }

  return (
    <div className="view-stub" data-testid="view-library">
      <h1>Library</h1>
      <p className="form-hint">
        Phase 4: capture via the library dump zone. Full library surfaces (attach-to-item, search, four content
        types editor) land in Phase 6.
      </p>
      <DumpZone
        projectId={projectId}
        target="library"
        policy={policy}
        sessions={sessions}
        onApplied={() => {
          api
            .listLibrary(projectId)
            .then((r) => setEntries(r.entries))
            .catch(() => {});
        }}
      />
      <ul className="library-entries" data-testid="library-entries">
        {entries.length === 0 && <li className="form-hint">No library entries yet.</li>}
        {entries.map((e) => (
          <li key={e.id}>
            <strong>{e.title}</strong>
            <span className="meta">{e.type}</span>
            <p>{e.body.slice(0, 240)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DirectivesView() {
  return (
    <Stub
      title="Directives"
      body="Pin / reminder / include-in-prompt directives land in Phase 6. Phase 2 ships the route as an empty stub."
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
