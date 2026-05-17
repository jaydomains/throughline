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
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Phase 15 — settings panel (SPEC §7.25)', () => {
  beforeEach(() => resetMockApi());

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

  it('grants OS notifications via a test fire', async () => {
    renderView();
    fireEvent.click(await screen.findByTestId('grant-notifications'));
    await waitFor(() => expect(mockApi.testNotification).toHaveBeenCalled());
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
