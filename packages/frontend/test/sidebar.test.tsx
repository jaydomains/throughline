import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { Sidebar } from '../src/components/Sidebar.js';
import type { MethodologySummary } from '../src/api.js';
import { resetMockApi } from './fixtures/mockApi.js';

beforeEach(() => {
  resetMockApi();
});

function loadedBundle(opts: { has_primary_unit: boolean; has_gates: boolean }): MethodologySummary {
  return {
    status: 'loaded',
    bundle_id: 'fake',
    identity: { name: 'fake', version: '1.0.0', authority_precedence: [] },
    has_primary_unit: opts.has_primary_unit,
    has_gates: opts.has_gates,
  };
}

function renderSidebar(bundle: MethodologySummary | undefined) {
  return render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <Sidebar activeProjectId="p1" bundle={bundle} />
    </MemoryRouter>,
  );
}

describe('Sidebar visibility', () => {
  it('hides Primary units and Gates when the bundle declares neither', () => {
    renderSidebar(loadedBundle({ has_primary_unit: false, has_gates: false }));
    expect(screen.queryByText('Primary units')).toBeNull();
    expect(screen.queryByText('Gates')).toBeNull();
    // Other nav items still render.
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Tree')).toBeInTheDocument();
    expect(screen.getByText('Graph')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Drift inbox')).toBeInTheDocument();
    expect(screen.getByText('Directives')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows Primary units when the bundle declares a primary unit', () => {
    renderSidebar(loadedBundle({ has_primary_unit: true, has_gates: false }));
    expect(screen.getByText('Primary units')).toBeInTheDocument();
    expect(screen.queryByText('Gates')).toBeNull();
  });

  it('shows Gates when the bundle declares gates', () => {
    renderSidebar(loadedBundle({ has_primary_unit: false, has_gates: true }));
    expect(screen.getByText('Gates')).toBeInTheDocument();
    expect(screen.queryByText('Primary units')).toBeNull();
  });

  it('renders only the settings link when no project is active', () => {
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <Sidebar activeProjectId={null} bundle={undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('settings-link')).toBeInTheDocument();
    expect(screen.queryByText('Home')).toBeNull();
  });
});
