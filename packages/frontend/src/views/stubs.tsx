import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { Project } from '@throughline/shared';
import type { MethodologySummary } from '../api.js';
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
  return (
    <Stub
      title="Home"
      body="Phase 14 fills this with the across-everything surface (recent activity, drift inbox count, scratchpad jots). Phase 2 ships the route as an empty stub."
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
