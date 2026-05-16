import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';
import {
  GraphView,
  HomeView,
  ModulesView,
  ProjectsView,
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

const rich: MethodologySummary = {
  status: 'loaded',
  bundle_id: 'rich',
  identity: { name: 'rich', version: '1.0.0', authority_precedence: [] },
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

  it('renders Graph stub (Sessions/Tree/Library/Directives are now live views, tested separately)', () => {
    render(
      <MemoryRouter>
        <GraphView />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Graph' })).toBeInTheDocument();
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
        bundle_path: null,
        state: 'active',
        settings_json: {},
        created_at: '',
        updated_at: '',
        archived_at: null,
      },
    ];
    render(
      <MemoryRouter>
        <ModalStackProvider>
          <ProjectsView projects={projects} bundles={[]} onCreated={() => {}} />
        </ModalStackProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByTestId('new-project-button')).toBeInTheDocument();
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
            element={<ModulesView bundles={[rich]} projectBundleId="rich" />}
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
