import type { MethodologySummary } from '../api.js';

export interface ViewModeDef {
  id: string;
  label: string;
  // route within the project context
  routeFor: (projectId: string) => string;
  // path match pattern relative to /projects/:id
  pathMatch: string;
  // visibility predicate: defaults to always-visible
  visibleFor?: (bundle: MethodologySummary | undefined) => boolean;
}

export const VIEW_MODES: ViewModeDef[] = [
  { id: 'home', label: 'Home', routeFor: (id) => `/projects/${id}`, pathMatch: '' },
  {
    id: 'sessions',
    label: 'Sessions',
    routeFor: (id) => `/projects/${id}/sessions`,
    pathMatch: 'sessions/*',
  },
  {
    id: 'modules',
    label: 'Modules',
    routeFor: (id) => `/projects/${id}/modules`,
    pathMatch: 'modules',
    visibleFor: (bundle) => bundle?.status === 'loaded' && bundle.has_primary_unit === true,
  },
  {
    id: 'tree',
    label: 'Tree',
    routeFor: (id) => `/projects/${id}/tree`,
    pathMatch: 'tree',
  },
  {
    id: 'graph',
    label: 'Graph',
    routeFor: (id) => `/projects/${id}/graph`,
    pathMatch: 'graph',
  },
  {
    id: 'library',
    label: 'Library',
    routeFor: (id) => `/projects/${id}/library`,
    pathMatch: 'library',
  },
  {
    id: 'directives',
    label: 'Directives',
    routeFor: (id) => `/projects/${id}/directives`,
    pathMatch: 'directives',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    routeFor: (id) => `/projects/${id}/intelligence`,
    pathMatch: 'intelligence',
  },
  {
    id: 'methodology-gates',
    label: 'Methodology gates',
    routeFor: (id) => `/projects/${id}/methodology-gates`,
    pathMatch: 'methodology-gates',
    visibleFor: (bundle) => bundle?.status === 'loaded' && bundle.has_gates === true,
  },
];

export type ViewMode = ViewModeDef;

export function viewModeVisible(mode: ViewModeDef, bundle: MethodologySummary | undefined): boolean {
  if (!mode.visibleFor) return true;
  return mode.visibleFor(bundle);
}
