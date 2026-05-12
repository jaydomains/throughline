import { NavLink } from 'react-router-dom';
import { VIEW_MODES, viewModeVisible } from '../views/modes.js';
import type { MethodologySummary } from '../api.js';

interface ViewToggleProps {
  activeProjectId: string;
  bundle: MethodologySummary | undefined;
}

export function ViewToggle({ activeProjectId, bundle }: ViewToggleProps) {
  return (
    <nav className="view-toggle" aria-label="View modes">
      {VIEW_MODES.filter((m) => viewModeVisible(m, bundle)).map((m) => {
        const to = m.routeFor(activeProjectId);
        return (
          <NavLink
            key={m.id}
            to={to}
            end={m.id === 'home'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {m.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
