import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ViewToggle } from '../src/components/ViewToggle.js';
import type { MethodologySummary } from '../src/api.js';

function loadedBundle(opts: { has_primary_unit: boolean; has_gates: boolean }): MethodologySummary {
  return {
    status: 'loaded',
    bundle_id: 'fake',
    identity: { name: 'fake', version: '1.0.0', authority_precedence: [] },
    has_primary_unit: opts.has_primary_unit,
    has_gates: opts.has_gates,
  };
}

describe('ViewToggle visibility', () => {
  it('hides Modules and Methodology gates when the bundle declares neither', () => {
    const bundle = loadedBundle({ has_primary_unit: false, has_gates: false });
    render(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <ViewToggle activeProjectId="p1" bundle={bundle} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Modules')).toBeNull();
    expect(screen.queryByText('Methodology gates')).toBeNull();
    // Other view modes still render.
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Tree')).toBeInTheDocument();
    expect(screen.getByText('Graph')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Directives')).toBeInTheDocument();
  });

  it('shows Modules when the bundle declares a primary unit', () => {
    const bundle = loadedBundle({ has_primary_unit: true, has_gates: false });
    render(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <ViewToggle activeProjectId="p1" bundle={bundle} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Modules')).toBeInTheDocument();
    expect(screen.queryByText('Methodology gates')).toBeNull();
  });

  it('shows Methodology gates when the bundle declares gates', () => {
    const bundle = loadedBundle({ has_primary_unit: false, has_gates: true });
    render(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <ViewToggle activeProjectId="p1" bundle={bundle} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Methodology gates')).toBeInTheDocument();
    expect(screen.queryByText('Modules')).toBeNull();
  });
});
