import { Navigate, useParams } from 'react-router-dom';
import type { Project } from '@throughline/shared';
import type { MethodologySummary } from '../api.js';
import { findBundle } from '../hooks/useMethodologies.js';

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

export function ProjectsView({ projects }: { projects: Project[] }) {
  return (
    <div className="view-stub" data-testid="view-projects">
      <h1>Projects</h1>
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
        {projects.length === 0 && <p>No projects yet. Create one via the CLI for now.</p>}
      </div>
    </div>
  );
}

export function HomeView() {
  return (
    <Stub
      title="Home"
      body="Phase 14 fills this with the across-everything surface (recent activity, drift inbox count, scratchpad jots). Phase 2 ships the route as an empty stub."
    />
  );
}

export function SessionView() {
  const { sessionId } = useParams();
  return (
    <Stub
      title={`Session ${sessionId ?? ''}`}
      body="Phase 3 lands sessions + items CRUD. Phase 2 ships the route as an empty stub."
    />
  );
}

export function SessionsIndex() {
  return (
    <Stub
      title="Sessions"
      body="Sidebar of session views lands in Phase 3 alongside the session boards. Phase 2 ships the route as an empty stub."
    />
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

export function TreeView() {
  return (
    <Stub
      title="Tree"
      body="File-explorer-style hierarchy lands when items exist (Phase 3). Phase 2 ships the route as an empty stub."
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
  return (
    <Stub
      title="Library"
      body="Notes / prompts / snippets / imported docs land in Phase 6. Phase 2 ships the route as an empty stub."
    />
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
