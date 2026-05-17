import { Link } from 'react-router-dom';
import type { Project } from '@throughline/shared';
import type { MethodologySummary } from '../api.js';
import { findBundle } from '../hooks/useMethodologies.js';
import { useDirectives } from '../hooks/useDirectives.js';
import { useDriftInbox } from '../hooks/useDriftInbox.js';
import { useCostMeter } from '../hooks/useCostMeter.js';
import { useBackupStatus } from '../hooks/useBackupStatus.js';
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
  const { summary: cost } = useCostMeter(activeProjectId);
  const { status: backup } = useBackupStatus();

  const todaySpend = cost ? cost.day.usd_estimate : 0;
  const costOver = cost?.daily_threshold_exceeded ?? false;
  const costTitle = cost
    ? `Today $${cost.day.usd_estimate.toFixed(2)} · week $${cost.week.usd_estimate.toFixed(
        2,
      )} · month $${cost.month.usd_estimate.toFixed(2)}${
        cost.daily_threshold_usd !== null
          ? ` · daily limit $${cost.daily_threshold_usd.toFixed(2)}`
          : ''
      }`
    : 'Cost meter — loading';
  const backupTitle = backup
    ? backup.last_backup_at
      ? `Last backup ${new Date(backup.last_backup_at).toLocaleString()}${
          backup.stale ? ` · over ${backup.threshold_days}d — back up now` : ''
        }${backup.auto_copy_target_path ? '' : ' · no off-disk auto-copy configured'}`
      : 'No backup yet — export or configure auto-copy'
    : 'Backup status — loading';

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

      <Link
        to="/settings"
        className={`header-pill cost-meter${costOver ? ' danger' : ''}`}
        title={costTitle}
        data-testid="cost-meter"
      >
        ${todaySpend.toFixed(2)} today
      </Link>

      <Link
        to="/settings"
        className="header-pill backup-indicator"
        title={backupTitle}
        data-testid="backup-indicator"
      >
        <span className={`dot ${backup && !backup.stale ? 'ok' : 'danger'}`} /> backup
      </Link>

      <Link
        to="/settings"
        className="header-pill settings-link"
        title="Settings (SPEC §7.25)"
        aria-label="Open settings"
        data-testid="settings-link"
      >
        ⚙
      </Link>

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
