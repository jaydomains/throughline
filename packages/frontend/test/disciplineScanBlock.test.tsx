import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { DisciplineScanBlock } from '../src/views/SettingsView.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';
import type { Project } from '@throughline/shared';

// Phase 22 Slice 2 — DisciplineScanBlock (T-D57; SPEC §7.14 "Scan-on-demand
// for bootstrapped projects"). Sibling of BootstrapBlock; consumes slice 1's
// settings_json.discipline_scan_state + last_run_at, and the extended
// DisciplineDriftRescanResult response shape.

function makeProject(settings: Record<string, unknown> = {}): Project {
  return {
    id: 'p1',
    name: 'demo',
    bundle_id: 'freeform',
    bundle_path: null,
    repo_path: '/tmp/repo',
    github_owner: null,
    github_repo: null,
    state: 'active',
    settings_json: settings,
    created_at: '2026-05-28T00:00:00.000Z',
    updated_at: '2026-05-28T00:00:00.000Z',
    archived_at: null,
    throughline_status: 'complete',
  };
}

function renderBlock(settings: Record<string, unknown> = {}, onScanned = vi.fn(async () => {})) {
  const project = makeProject(settings);
  return { project, onScanned, ...render(<DisciplineScanBlock project={project} onScanned={onScanned} />) };
}

describe('DisciplineScanBlock — state-driven affordance shape (T-D57)', () => {
  beforeEach(() => resetMockApi());

  it('renders the prominent CTA when state is pre-scan (bootstrap-day-one case)', () => {
    renderBlock({ discipline_scan_state: 'pre-scan' });
    const block = screen.getByTestId('discipline-scan-block');
    expect(block.getAttribute('data-state')).toBe('pre-scan');
    expect(block.getAttribute('data-prominence')).toBe('prominent');
    expect(block.textContent).toContain('Discipline scan pending');
    expect(block.textContent).toContain('Bootstrap brought this project');
    expect((screen.getByTestId('discipline-scan-button') as HTMLButtonElement).textContent).toBe('Run discipline scan');
    expect((screen.getByTestId('discipline-scan-button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders the demoted re-scan affordance with last_run_at when state is complete', () => {
    renderBlock({
      discipline_scan_state: 'complete',
      discipline_scan_last_run_at: '2026-05-28T14:00:00.000Z',
    });
    const block = screen.getByTestId('discipline-scan-block');
    expect(block.getAttribute('data-state')).toBe('complete');
    expect(block.getAttribute('data-prominence')).toBe('demoted');
    expect(block.textContent).toContain('Last scanned');
    expect((screen.getByTestId('discipline-scan-button') as HTMLButtonElement).textContent).toBe('Re-run discipline scan');
  });

  it('non-bootstrap projects (absent state ≡ complete-implicit) still see a re-scan affordance', () => {
    // Q3A: "one trigger, two surfaces" — the trigger surfaces for ALL
    // projects, including non-bootstrap ones, as a re-scan affordance.
    // Mirrors the periodic-review gate's "suppress when pre-scan or running"
    // invariant (slice 1): absent state is the implicit "complete" case
    // and existing on-bind behaviour for non-bootstrap projects is unchanged.
    renderBlock({});
    const block = screen.getByTestId('discipline-scan-block');
    expect(block.getAttribute('data-state')).toBe('absent');
    expect(block.getAttribute('data-prominence')).toBe('demoted');
    expect((screen.getByTestId('discipline-scan-button') as HTMLButtonElement).textContent).toBe('Re-run discipline scan');
    // No "Last scanned" string because there's no timestamp; falls back to the
    // generic "Run a discipline scan…" hint.
    expect(block.textContent).toContain('Run a discipline scan to surface drift signals');
  });

  it('renders the disabled "Scanning…" affordance while state is running', () => {
    renderBlock({ discipline_scan_state: 'running' });
    const btn = screen.getByTestId('discipline-scan-button') as HTMLButtonElement;
    expect(btn.textContent).toBe('Scanning…');
    expect(btn.disabled).toBe(true);
  });
});

describe('DisciplineScanBlock — rescan flow (consumes DisciplineDriftRescanResult)', () => {
  beforeEach(() => resetMockApi());

  it('clicking Run discipline scan calls api.rescanDisciplineDrift and flips to complete', async () => {
    const onScanned = vi.fn(async () => {});
    mockApi.rescanDisciplineDrift.mockResolvedValueOnce({
      groups: [],
      discipline_scan_state: 'complete',
      discipline_scan_last_run_at: '2026-05-28T14:30:00.000Z',
    });
    renderBlock({ discipline_scan_state: 'pre-scan' }, onScanned);

    fireEvent.click(screen.getByTestId('discipline-scan-button'));

    await waitFor(() =>
      expect(screen.getByTestId('discipline-scan-block').getAttribute('data-state')).toBe('complete'),
    );
    expect(mockApi.rescanDisciplineDrift).toHaveBeenCalledWith('p1');
    expect(onScanned).toHaveBeenCalled();
    expect(screen.getByTestId('discipline-scan-block').textContent).toContain('Last scanned');
  });

  it('optimistically flips to running on click before the response arrives', async () => {
    let resolveRescan: (value: {
      groups: never[];
      discipline_scan_state: 'complete';
      discipline_scan_last_run_at: string;
    }) => void = () => {};
    mockApi.rescanDisciplineDrift.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRescan = resolve;
        }),
    );
    renderBlock({ discipline_scan_state: 'pre-scan' });

    fireEvent.click(screen.getByTestId('discipline-scan-button'));

    await waitFor(() => {
      expect(screen.getByTestId('discipline-scan-block').getAttribute('data-state')).toBe('running');
    });
    expect((screen.getByTestId('discipline-scan-button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('discipline-scan-button').textContent).toBe('Scanning…');

    resolveRescan({
      groups: [],
      discipline_scan_state: 'complete',
      discipline_scan_last_run_at: '2026-05-28T14:30:00.000Z',
    });
    await waitFor(() =>
      expect(screen.getByTestId('discipline-scan-block').getAttribute('data-state')).toBe('complete'),
    );
  });

  it('surfaces an inline error and reverts the optimistic running state on rescan failure', async () => {
    mockApi.rescanDisciplineDrift.mockRejectedValueOnce(new Error('500 Internal Server Error'));
    renderBlock({ discipline_scan_state: 'pre-scan' });

    fireEvent.click(screen.getByTestId('discipline-scan-button'));

    await waitFor(() => expect(screen.queryByTestId('discipline-scan-error')).toBeTruthy());
    expect(screen.getByTestId('discipline-scan-error').textContent).toContain('500 Internal Server Error');
    // Reverts to pre-scan because the local optimistic flip is rolled back
    // on failure. Slice 1's try/finally would have already moved the
    // persisted state to complete on the backend, so the subsequent
    // onScanned re-fetch (not triggered here because we threw) would correct
    // the UI. Without a re-fetch we show the persisted pre-scan.
    expect(screen.getByTestId('discipline-scan-block').getAttribute('data-state')).toBe('pre-scan');
  });

  it('refreshes onScanned() after success so the outer project record re-fetches', async () => {
    const onScanned = vi.fn(async () => {});
    mockApi.rescanDisciplineDrift.mockResolvedValueOnce({
      groups: [],
      discipline_scan_state: 'complete',
      discipline_scan_last_run_at: '2026-05-28T14:30:00.000Z',
    });
    renderBlock({ discipline_scan_state: 'complete', discipline_scan_last_run_at: '2026-05-28T12:00:00.000Z' }, onScanned);

    fireEvent.click(screen.getByTestId('discipline-scan-button'));
    await waitFor(() => expect(onScanned).toHaveBeenCalledTimes(1));
  });
});
