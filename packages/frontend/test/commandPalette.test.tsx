import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from '../src/components/CommandPalette.js';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';
import type { Project } from '@throughline/shared';
import type { MethodologySummary } from '../src/api.js';

const proj = (id: string, name: string, bundle_id = 'freeform'): Project => ({
  id,
  name,
  repo_path: '/tmp/' + id,
  github_owner: null,
  github_repo: null,
  bundle_id,
  bundle_path: null,
  state: 'active',
  settings_json: {},
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  archived_at: null,
});

const freeform: MethodologySummary = {
  status: 'loaded',
  bundle_id: 'freeform',
  identity: { name: 'freeform', version: '1.0.0', authority_precedence: [] },
  has_primary_unit: false,
  has_gates: false,
};

describe('CommandPalette', () => {
  it('renders project entries and fuzzy-filters by query', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ModalStackProvider>
          <CommandPalette
            open
            onClose={() => {}}
            projects={[proj('p1', 'Alpha'), proj('p2', 'Beta')]}
            bundles={[freeform]}
            activeProjectId={null}
          />
        </ModalStackProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Open project: Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Open project: Beta/)).toBeInTheDocument();

    await user.type(screen.getByRole('textbox'), 'alph');
    expect(screen.getByText(/Open project: Alpha/)).toBeInTheDocument();
    expect(screen.queryByText(/Open project: Beta/)).toBeNull();
  });

  it('lists active project view modes filtered by bundle visibility', () => {
    render(
      <MemoryRouter>
        <ModalStackProvider>
          <CommandPalette
            open
            onClose={() => {}}
            projects={[proj('p1', 'Alpha')]}
            bundles={[freeform]}
            activeProjectId="p1"
          />
        </ModalStackProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/View: Home/)).toBeInTheDocument();
    expect(screen.getByText(/View: Tree/)).toBeInTheDocument();
    // Freeform bundle: modules and methodology-gates hidden.
    expect(screen.queryByText(/View: Modules/)).toBeNull();
    expect(screen.queryByText(/View: Methodology gates/)).toBeNull();
  });

  it('closes via onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <ModalStackProvider>
          <CommandPalette
            open
            onClose={onClose}
            projects={[]}
            bundles={[]}
            activeProjectId={null}
          />
        </ModalStackProvider>
      </MemoryRouter>,
    );
    const backdrop = screen.getByRole('dialog');
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
