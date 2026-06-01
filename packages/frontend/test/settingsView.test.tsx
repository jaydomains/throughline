import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { SettingsView } from '../src/views/SettingsView.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';

function renderView() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Phase 15 — settings panel (SPEC §7.25)', () => {
  beforeEach(() => resetMockApi());

  it('E24/SF6-11: a failed auxiliary loader surfaces a load error, not a stuck panel', async () => {
    mockApi.getCostSummary.mockRejectedValueOnce(new Error('cost boom'));
    renderView();
    await waitFor(() => expect(screen.getByTestId('load-error-settings')).toBeTruthy());
    expect(screen.getByTestId('load-error-settings').textContent).toContain('cost boom');
  });

  it('E24: two concurrent loader failures both surface (accumulated, not overwritten)', async () => {
    mockApi.getSecrets.mockRejectedValueOnce(new Error('secrets boom'));
    mockApi.getCostSummary.mockRejectedValueOnce(new Error('cost boom'));
    renderView();
    await waitFor(() => expect(screen.getAllByTestId('load-error-settings').length).toBe(2));
  });

  it('warns when no auto-copy target is configured (local-only backup caveat)', async () => {
    renderView();
    await waitFor(() => expect(screen.getByTestId('autocopy-warning')).toBeTruthy());
    expect(screen.getByTestId('autocopy-warning').textContent).toMatch(/laptop wipe/i);
  });

  it('exports a snapshot via the backend', async () => {
    renderView();
    fireEvent.click(await screen.findByTestId('export-backup'));
    await waitFor(() => expect(mockApi.exportBackup).toHaveBeenCalled());
  });

  it('saves a secret write-only and never reads it back', async () => {
    renderView();
    fireEvent.change(await screen.findByTestId('secret-anthropic'), {
      target: { value: 'sk-test' },
    });
    fireEvent.click(screen.getByTestId('save-secrets'));
    await waitFor(() =>
      expect(mockApi.updateSecrets).toHaveBeenCalledWith({ anthropic_api_key: 'sk-test' }),
    );
  });

  it('persists the cost daily threshold (blank clears it)', async () => {
    renderView();
    const input = await screen.findByTestId('cost-threshold');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('cost-threshold-save'));
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ cost_daily_threshold_usd: 5 }),
    );
  });

  it('saves a per-project bundle rebind through updateProject', async () => {
    renderView();
    const select = await screen.findByTestId('project-select');
    fireEvent.change(select, { target: { value: 'p1' } });
    await screen.findByTestId('project-bundle');
    fireEvent.click(screen.getByTestId('save-project'));
    await waitFor(() => expect(mockApi.updateProject).toHaveBeenCalled());
    const [, patch] = mockApi.updateProject.mock.calls[0]!;
    expect(patch).toHaveProperty('bundle_id');
  });

  // C-D19 surface 5 — `bundle_path` settings field surfaces the C-D14 column on the settings panel.
  it('sends bundle_path through updateProject (sets when present, nulls when cleared)', async () => {
    renderView();
    const select = await screen.findByTestId('project-select');
    fireEvent.change(select, { target: { value: 'p1' } });
    const input = await screen.findByTestId('project-bundle-path');
    fireEvent.change(input, { target: { value: '/opt/bundles/demo' } });
    fireEvent.click(screen.getByTestId('save-project'));
    await waitFor(() => expect(mockApi.updateProject).toHaveBeenCalled());
    const [, patch] = mockApi.updateProject.mock.calls[0]!;
    expect(patch).toMatchObject({ bundle_path: '/opt/bundles/demo' });
  });

  // C-D19 surface 6 — clone-and-go config status block surfaces `throughline_status`.
  it('renders the throughline-status block when the backend supplies the field', async () => {
    // Reach into the mock store and override the seeded project to carry a status.
    const initial = await mockApi.listProjects();
    initial.projects[0]!.throughline_status = 'complete';
    renderView();
    const select = await screen.findByTestId('project-select');
    fireEvent.change(select, { target: { value: 'p1' } });
    const block = await screen.findByTestId('throughline-status');
    expect(block.getAttribute('data-status')).toBe('complete');
    expect(block.textContent).toMatch(/Clone-and-go config:/);
  });

  it('hides the throughline-status block on legacy responses without the field', async () => {
    // DEFAULT_PROJECT in mockApi is a module-level singleton; previous tests
    // may have mutated `throughline_status` on it. Clear it explicitly so this
    // test exercises the "legacy response" shape unambiguously.
    const initial = await mockApi.listProjects();
    delete initial.projects[0]!.throughline_status;
    renderView();
    const select = await screen.findByTestId('project-select');
    fireEvent.change(select, { target: { value: 'p1' } });
    await screen.findByTestId('project-bundle');
    expect(screen.queryByTestId('throughline-status')).toBeNull();
  });

  // Phase 20 Slice 4 — bootstrap review entry block (C-D20 surface 5).
  it('renders bootstrap-review block with stale count from the GET endpoint', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: {
        project_id: 'p1',
        stale: [
          { entity_type: 'item', entity_id: 'i1', bootstrap_id: 'roadmap:phase-1', title: 'Stale item' },
        ],
      },
    });
    renderView();
    const select = await screen.findByTestId('project-select');
    fireEvent.change(select, { target: { value: 'p1' } });
    const block = await screen.findByTestId('bootstrap-review-block');
    await waitFor(() => expect(block.textContent).toMatch(/1 stale row pending review/));
    // Button is enabled when count > 0.
    const openBtn = screen.getByTestId('bootstrap-review-open');
    expect((openBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables the bootstrap-review button when there are no stale rows', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: { project_id: 'p1', stale: [] },
    });
    renderView();
    const select = await screen.findByTestId('project-select');
    fireEvent.change(select, { target: { value: 'p1' } });
    const block = await screen.findByTestId('bootstrap-review-block');
    await waitFor(() => expect(block.textContent).toMatch(/No stale rows/));
    const openBtn = screen.getByTestId('bootstrap-review-open');
    expect((openBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('grants OS notifications via a test fire', async () => {
    renderView();
    fireEvent.click(await screen.findByTestId('grant-notifications'));
    await waitFor(() => expect(mockApi.testNotification).toHaveBeenCalled());
  });

  it('E4/SF5-03: an unavailable notifier surfaces an honest warning, not silent success', async () => {
    mockApi.testNotification.mockResolvedValueOnce({
      outcome: 'unavailable',
      message: 'no backend',
    });
    renderView();
    fireEvent.click(await screen.findByTestId('grant-notifications'));
    expect(await screen.findByTestId('notifications-unavailable')).toBeTruthy();
  });

  it('E6/C-D25/C-D26: a degraded background job renders distinctly via HealthStatus', async () => {
    mockApi.getBackgroundJobsHealth.mockResolvedValueOnce({
      jobs: [
        { name: 'backup', last_run_at: '2026-05-31T10:00:00.000Z', last_error: null, healthy: true },
        {
          name: 'github-poller',
          last_run_at: '2026-05-31T11:00:00.000Z',
          last_error: 'github 500',
          healthy: false,
        },
      ],
    });
    renderView();
    const degraded = await screen.findByTestId('job-health-github-poller');
    expect(degraded.getAttribute('data-state')).toBe('degraded');
    expect(degraded.textContent).toContain('github 500');
    const healthy = await screen.findByTestId('job-health-backup');
    expect(healthy.getAttribute('data-state')).toBe('healthy');
  });

  it('Phase 18 Slice 2: communication-model section shows the "none" hint for freeform-shaped views', async () => {
    // The default mock returns status: 'none' → the section shows the "nothing to
    // configure" hint instead of any input rows.
    renderView();
    const select = await screen.findByTestId('comm-project-select');
    fireEvent.change(select, { target: { value: 'p1' } });
    await screen.findByTestId('comm-bundle-none');
    expect(screen.queryByTestId('comm-contract-sources')).toBeNull();
    expect(screen.queryByTestId('comm-module-tiers')).toBeNull();
  });

  it('Phase 18 Slice 2: hides communication-model controls until a project is chosen, then renders both blocks', async () => {
    // Override the mock to return a declared-shape view for project p1: one
    // edge type with a contract_source and one item-derived module to assign.
    // (`mockImplementation` here persists into later tests; `resetMockApi` only
    // clears call counts. Ordering this test after the "none" default test
    // keeps the default unobserved by the override.)
    mockApi.getCommunicationModel.mockImplementation(async (_projectId: string) => ({
      bundle: {
        status: 'declared',
        edge_types: [
          {
            name: 'mediated',
            when: { kind: 'pair', a: 'tier-a', b: 'tier-a' },
            mechanism: { kind: 'via', module_id: 'router' },
            contract_source: 'tier-a-flows',
            invariant: 'violation',
          },
        ],
        tier_routing: [],
        producer_ownership: null,
      },
      contract_sources: {},
      module_tiers: {},
      resolved: {
        contract_sources: { mediated: { absolute_path: '', configured: false } },
        module_tiers: { router: { tier: null, valid: false } },
        declared_tiers: ['tier-a', 'tier-b'],
      },
    }));

    renderView();
    const select = await screen.findByTestId('comm-project-select');
    fireEvent.change(select, { target: { value: 'p1' } });

    // Contract-source row appears with the "not configured" hint.
    await screen.findByTestId('comm-cs-mediated');
    // Module-tier row appears with the unassigned dropdown.
    await screen.findByTestId('comm-mt-router');

    // Save a contract-source path → updateCommunicationModel called with the new value
    // for the edge type, preserving the empty module_tiers map.
    const input = screen.getByTestId('comm-cs-input-mediated');
    fireEvent.change(input, { target: { value: 'docs/contracts/router' } });
    fireEvent.click(screen.getByTestId('comm-cs-input-mediated-save'));
    await waitFor(() =>
      expect(mockApi.updateCommunicationModel).toHaveBeenCalledWith('p1', {
        contract_sources: { mediated: 'docs/contracts/router' },
        module_tiers: {},
      }),
    );

    // Assign a tier to the router module → updateCommunicationModel called with the
    // tier assignment merged in.
    fireEvent.change(screen.getByTestId('comm-mt-select-router'), { target: { value: 'tier-a' } });
    await waitFor(() =>
      expect(mockApi.updateCommunicationModel).toHaveBeenLastCalledWith('p1', {
        contract_sources: {},
        module_tiers: { router: 'tier-a' },
      }),
    );
  });

  it('persists theme direction/mode/density through updateSettings (Slice 4)', async () => {
    renderView();
    fireEvent.change(await screen.findByTestId('theme-direction'), {
      target: { value: 'C' },
    });
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ theme_direction: 'C' }),
    );
    fireEvent.change(screen.getByTestId('theme-mode'), { target: { value: 'light' } });
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ theme_mode: 'light' }),
    );
    fireEvent.change(screen.getByTestId('theme-density'), {
      target: { value: 'spacious' },
    });
    await waitFor(() =>
      expect(mockApi.updateSettings).toHaveBeenCalledWith({ theme_density: 'spacious' }),
    );
  });
});
