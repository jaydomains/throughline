import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ModulesView } from '../src/views/stubs.js';
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
  it('ModulesView redirects when the bundle declares no primary unit', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/projects/p1/modules']}>
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/projects/p1/modules']}>
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

});
