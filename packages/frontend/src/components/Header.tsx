import { Link } from 'react-router-dom';
import type { Project } from '@throughline/shared';
import type { MethodologySummary } from '../api.js';
import { useCostMeter } from '../hooks/useCostMeter.js';
import { Wordmark } from './Wordmark.js';
import { Icon } from './Icon.js';
import { ProjectSwitcher } from './ProjectSwitcher.js';
import { Scratchpad } from './Scratchpad.js';
import { InboxStatus } from './InboxStatus.js';

interface HeaderProps {
  projects: Project[];
  bundles: MethodologySummary[];
  activeProjectId: string | null;
  onOpenPalette: () => void;
  sseConnected: boolean;
  // v1 default; Slice 4 feeds this from settings.
  direction?: 'A' | 'B' | 'C';
}

export function Header({
  projects,
  activeProjectId,
  onOpenPalette,
  sseConnected,
  direction = 'A',
}: HeaderProps) {
  const { summary: cost } = useCostMeter(activeProjectId);
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

  return (
    <header className="head" role="banner">
      <Link to="/projects" aria-label="Throughline home" className="wordmark-link">
        <Wordmark direction={direction} />
      </Link>

      <span className="head-rule" aria-hidden="true" />

      <ProjectSwitcher projects={projects} activeProjectId={activeProjectId} />

      <div className="spacer" />

      <Scratchpad activeProjectId={activeProjectId} />

      <InboxStatus />

      <Link
        to="/settings"
        className={`head-pill cost-meter${costOver ? ' danger' : ''}`}
        title={costTitle}
        data-testid="cost-meter"
      >
        <span className={`dot ${costOver ? 'warn' : 'ok'}`} />
        <span>cost</span>
        <span className="mono">${todaySpend.toFixed(2)} / day</span>
      </Link>

      <span
        className="head-pill"
        title={sseConnected ? 'Backend live channel connected' : 'Live channel disconnected'}
        aria-label="Live channel status"
        data-testid="live-pill"
      >
        <span className={`dot ${sseConnected ? 'live' : 'warn'}`} />
        <span>live</span>
      </span>

      <button
        type="button"
        className="head-pill"
        onClick={onOpenPalette}
        aria-label="Open command palette"
        title="Command palette"
      >
        <Icon name="search" size={12} />
        <span>jump</span>
        <span className="kbd">⌘K</span>
      </button>
    </header>
  );
}
