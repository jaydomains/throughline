import { NavLink } from 'react-router-dom';
import type { MethodologySummary } from '../api.js';
import { useDirectives } from '../hooks/useDirectives.js';
import { useDriftInbox } from '../hooks/useDriftInbox.js';
import { Icon, type IconName } from './Icon.js';

// Replaces the header ViewToggle strip with the design-handoff sidebar:
// two grouped nav rails (Project / Methodology) plus a settings link.
// Visibility predicates are unchanged from views/modes.ts — Primary units
// and Gates still hide on bundles that declare neither.

interface NavDef {
  id: string;
  label: string;
  icon: IconName;
  to: (projectId: string) => string;
  end?: boolean;
  visibleFor?: (bundle: MethodologySummary | undefined) => boolean;
}

const PROJECT_NAV: NavDef[] = [
  { id: 'home', label: 'Home', icon: 'home', to: (id) => `/projects/${id}`, end: true },
  { id: 'capture', label: 'Dump zone', icon: 'note', to: (id) => `/projects/${id}/capture` },
  { id: 'sessions', label: 'Sessions', icon: 'session', to: (id) => `/projects/${id}/sessions` },
  {
    id: 'modules',
    label: 'Primary units',
    icon: 'modules',
    to: (id) => `/projects/${id}/modules`,
    visibleFor: (b) => b?.status === 'loaded' && b.has_primary_unit === true,
  },
  { id: 'tree', label: 'Tree', icon: 'tree', to: (id) => `/projects/${id}/tree` },
  { id: 'graph', label: 'Graph', icon: 'graph', to: (id) => `/projects/${id}/graph` },
  { id: 'library', label: 'Library', icon: 'library', to: (id) => `/projects/${id}/library` },
  { id: 'intelligence', label: 'Intelligence', icon: 'spark', to: (id) => `/projects/${id}/intelligence` },
];

const METHODOLOGY_NAV: NavDef[] = [
  {
    id: 'methodology-gates',
    label: 'Gates',
    icon: 'gate',
    to: (id) => `/projects/${id}/methodology-gates`,
    visibleFor: (b) => b?.status === 'loaded' && b.has_gates === true,
  },
  { id: 'drift-inbox', label: 'Drift inbox', icon: 'drift', to: (id) => `/projects/${id}/drift-inbox` },
  { id: 'directives', label: 'Directives', icon: 'directives', to: (id) => `/projects/${id}/directives` },
];

interface SidebarProps {
  activeProjectId: string | null;
  bundle: MethodologySummary | undefined;
}

export function Sidebar({ activeProjectId, bundle }: SidebarProps) {
  const { directives } = useDirectives(activeProjectId);
  const { inbox } = useDriftInbox(activeProjectId);

  const counts: Record<string, { count?: number; warn?: number }> = {
    directives: { count: directives.length },
    'drift-inbox': inbox.total_count > 0 ? { warn: inbox.total_count } : {},
  };

  const renderItem = (n: NavDef) => {
    if (!activeProjectId) return null;
    if (n.visibleFor && !n.visibleFor(bundle)) return null;
    const c = counts[n.id] ?? {};
    return (
      <NavLink
        key={n.id}
        to={n.to(activeProjectId)}
        end={n.end ?? false}
        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      >
        <span className="ico">
          <Icon name={n.icon} />
        </span>
        <span>{n.label}</span>
        {c.warn != null && (
          <span className="badge-warn" data-testid={`nav-warn-${n.id}`}>
            {c.warn}
          </span>
        )}
        {c.count != null && (
          <span className="count mono" data-testid={`nav-count-${n.id}`}>
            {c.count}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <aside className="side" aria-label="Primary navigation">
      {activeProjectId && (
        <>
          <div className="section-label">Project</div>
          {PROJECT_NAV.map(renderItem)}
          <div className="section-label">Methodology</div>
          {METHODOLOGY_NAV.map(renderItem)}
        </>
      )}
      <div style={{ flex: 1 }} />
      <NavLink
        to="/settings"
        className={({ isActive }) => `nav-item nav-settings${isActive ? ' active' : ''}`}
        data-testid="settings-link"
      >
        <span className="ico">
          <Icon name="settings" />
        </span>
        <span>Settings</span>
      </NavLink>
    </aside>
  );
}
