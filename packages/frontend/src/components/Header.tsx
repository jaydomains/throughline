import { Link } from 'react-router-dom';
import type { Project } from '@throughline/shared';
import type { MethodologySummary } from '../api.js';
import { findBundle } from '../hooks/useMethodologies.js';
import { ProjectSwitcher } from './ProjectSwitcher.js';
import { ScratchpadPlaceholder } from './ScratchpadPlaceholder.js';
import { ViewToggle } from './ViewToggle.js';

interface HeaderProps {
  projects: Project[];
  bundles: MethodologySummary[];
  activeProjectId: string | null;
  onOpenPalette: () => void;
  sseConnected: boolean;
}

export function Header({
  projects,
  bundles,
  activeProjectId,
  onOpenPalette,
  sseConnected,
}: HeaderProps) {
  const activeProject = activeProjectId
    ? projects.find((p) => p.id === activeProjectId) ?? null
    : null;
  const bundle = activeProject ? findBundle(bundles, activeProject.bundle_id) : undefined;

  return (
    <header className="header" role="banner">
      <Link to="/projects" className="app-name" aria-label="Throughline home">
        THROUGHLINE
      </Link>

      <ProjectSwitcher projects={projects} activeProjectId={activeProjectId} />

      {activeProject && <ViewToggle activeProjectId={activeProject.id} bundle={bundle} />}

      <div className="spacer" />

      <span
        className="header-pill"
        title={sseConnected ? 'Backend live channel connected' : 'Live channel disconnected'}
        aria-label="Live channel status"
      >
        <span className={`dot ${sseConnected ? 'ok' : 'danger'}`} />
        live
      </span>

      <ScratchpadPlaceholder />

      <span className="header-pill" title="Cost meter placeholder; wires up in Phase 15">
        $0.00 today
      </span>

      <span className="header-pill" title="Backup indicator placeholder; wires up in Phase 15">
        <span className="dot" /> backup
      </span>

      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Open command palette"
        title="Command palette"
      >
        <span className="kbd">⌘K</span>
      </button>
    </header>
  );
}
