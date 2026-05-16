import { Link } from 'react-router-dom';
import type { Project } from '@throughline/shared';
import type { MethodologySummary } from '../api.js';
import { findBundle } from '../hooks/useMethodologies.js';
import { useDirectives } from '../hooks/useDirectives.js';
import { useDriftInbox } from '../hooks/useDriftInbox.js';
import { InboxStatus } from './InboxStatus.js';
import { ProjectSwitcher } from './ProjectSwitcher.js';
import { Scratchpad } from './Scratchpad.js';
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
  const { directives } = useDirectives(activeProjectId);
  const { inbox } = useDriftInbox(activeProjectId);

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

      {activeProject && (
        <Link
          to={`/projects/${activeProject.id}/directives`}
          className="header-pill directives-hint"
          title="Active directives (T-D12)"
          data-testid="directives-hint"
        >
          Directives ({directives.length})
        </Link>
      )}

      {activeProject && (
        <Link
          to={`/projects/${activeProject.id}/drift-inbox`}
          className="header-pill drift-inbox-hint"
          title="Drift inbox — code tier-4 + discipline signals (SPEC §7.14)"
          data-testid="drift-inbox-hint"
        >
          Drift ({inbox.total_count})
        </Link>
      )}

      <Scratchpad activeProjectId={activeProjectId} />

      <InboxStatus />

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
