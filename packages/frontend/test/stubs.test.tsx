import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  DirectivesView,
  GraphView,
  HomeView,
  LibraryView,
  ModulesView,
  ProjectsView,
  SessionView,
  SessionsIndex,
  TreeView,
  GatesView,
} from '../src/views/stubs.js';
import type { Project } from '@throughline/shared';
import type { MethodologySummary } from '../src/api.js';

const freeform: MethodologySummary = {
  status: 'loaded',
  bundle_id: 'freeform',
  identity: { name: 'freeform', version: '1.0.0', authority_precedence: [] },
  has_primary_unit: false,
  has_gates: false,
};

const sitemesh: MethodologySummary = {
  status: 'loaded',
  bundle_id: 'sitemesh',
  identity: { name: 'sitemesh', version: '1.0.0', authority_precedence: [] },
  has_primary_unit: true,
  has_gates: true,
};

describe('View stubs', () => {
  it('HomeView renders its stub copy', () => {
    render(
      <MemoryRouter>
        <HomeView />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
  });

  it('renders Sessions, Tree, Graph, Library, Directives stubs', () => {
    const cases: Array<[string, React.ReactNode]> = [
      ['Sessions', <SessionsIndex />],
      ['Tree', <TreeView />],
      ['Graph', <GraphView />],
      ['Library', <LibraryView />],
      ['Directives', <DirectivesView />],
    ];
    for (const [label, el] of cases) {
      const { unmount } = render(<MemoryRouter>{el}</MemoryRouter>);
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
      unmount();
    }
  });

  it('SessionView includes the session id in its heading', () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1/sessions/s99']}>
        <Routes>
          <Route path="/projects/:id/sessions/:sessionId" element={<SessionView />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /Session s99/ })).toBeInTheDocument();
  });

  it('ProjectsView lists projects passed in', () => {
    const projects: Project[] = [
      {
        id: 'p1',
        name: 'Alpha',
        repo_path: '/tmp/alpha',
        github_owner: null,
        github_repo: null,
        bundle_id: 'freeform',
        state: 'active',
        settings_json: {},
        created_at: '',
        updated_at: '',
        archived_at: null,
      },
    ];
    render(
      <MemoryRouter>
        <ProjectsView projects={projects} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
  });

  it('ModulesView redirects when the bundle declares no primary unit', () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1/modules']}>
        <Routes>
          <Route
            path="/projects/:id/modules"
            element={<ModulesView bundles={[freeform]} projectBundleId="freeform" />}
          />
          <Route path="/projects/:id" element={<div>home-fallback</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('home-fallback')).toBeInTheDocument();
  });

  it('ModulesView renders when the bundle declares a primary unit', () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1/modules']}>
        <Routes>
          <Route
            path="/projects/:id/modules"
            element={<ModulesView bundles={[sitemesh]} projectBundleId="sitemesh" />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Modules' })).toBeInTheDocument();
  });

  it('GatesView redirects when the bundle declares no gates', () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1/methodology-gates']}>
        <Routes>
          <Route
            path="/projects/:id/methodology-gates"
            element={<GatesView bundles={[freeform]} projectBundleId="freeform" />}
          />
          <Route path="/projects/:id" element={<div>home-fallback</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('home-fallback')).toBeInTheDocument();
  });
});
