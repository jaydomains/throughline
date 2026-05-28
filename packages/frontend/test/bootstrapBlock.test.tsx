import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { BootstrapBlock } from '../src/views/SettingsView.js';
import { ModalStackProvider } from '../src/keyboard/modalStack.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';
import type { Project } from '@throughline/shared';

// C-D21 surface 6 (Phase 21 Slice 4 — chain-close) — unified Bootstrap &
// clone-and-go block. Replaces the previous ThroughlineStatusBlock + the
// BootstrapReviewBlock with one consolidated component. These tests cover
// BOTH retained behaviour (carried forward from the old blocks — chain-
// open carry-forward) AND the new render/state/quarantine affordances.

function renderBlock(project: Partial<Project> = {}) {
  const defaultProject: Project = {
    id: 'p1',
    name: 'demo',
    bundle_id: 'freeform',
    repo_path: '/tmp/repo',
    bundle_path: null,
    state: 'active',
    archived_at: null,
    github_owner: null,
    github_repo: null,
    created_at: '2026-05-28T00:00:00.000Z',
    throughline_status: 'complete',
    ...project,
  } as Project;
  return render(
    <ModalStackProvider>
      <BootstrapBlock project={defaultProject} />
    </ModalStackProvider>,
  );
}

describe('BootstrapBlock — retained behaviour from old blocks', () => {
  beforeEach(() => resetMockApi());

  // Carried forward from ThroughlineStatusBlock.
  it('renders the absent status banner when throughline_status is "absent"', async () => {
    renderBlock({ throughline_status: 'absent' });
    await waitFor(() =>
      expect(screen.getByTestId('throughline-status').getAttribute('data-status')).toBe('absent'),
    );
    expect(screen.getByTestId('throughline-status').textContent).toContain('No `.throughline/`');
    expect(screen.getByTestId('throughline-status').textContent).toContain('throughline init');
  });

  it('renders the partial status banner when throughline_status is "partial"', async () => {
    renderBlock({ throughline_status: 'partial' });
    await waitFor(() =>
      expect(screen.getByTestId('throughline-status').getAttribute('data-status')).toBe('partial'),
    );
    expect(screen.getByTestId('throughline-status').textContent).toContain('directory present but config missing');
  });

  it('renders the complete status banner when throughline_status is "complete"', async () => {
    renderBlock({ throughline_status: 'complete' });
    await waitFor(() =>
      expect(screen.getByTestId('throughline-status').getAttribute('data-status')).toBe('complete'),
    );
    expect(screen.getByTestId('throughline-status').textContent).toContain('present and valid');
  });

  it('hides the status banner entirely when throughline_status is undefined (legacy backend response)', async () => {
    renderBlock({ throughline_status: undefined });
    // The block itself still renders for review/state surfaces.
    expect(screen.getByTestId('bootstrap-block')).toBeTruthy();
    expect(screen.queryByTestId('throughline-status')).toBeNull();
  });

  // Carried forward from BootstrapReviewBlock.
  it('displays the stale-row count alongside a disabled review button when no stale rows', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: { project_id: 'p1', stale: [] },
    });
    renderBlock();
    await waitFor(() => expect(screen.getByTestId('bootstrap-review-block')).toBeTruthy());
    expect(screen.getByTestId('bootstrap-review-block').textContent).toContain('No stale rows.');
    expect((screen.getByTestId('bootstrap-review-open') as HTMLButtonElement).disabled).toBe(true);
  });

  it('displays the stale-row count and enables the review button when stale rows exist', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: {
        project_id: 'p1',
        stale: [
          { entity_type: 'item', entity_id: 'i1', bootstrap_id: 'roadmap:phase-1', title: 'Item 1' },
          { entity_type: 'item', entity_id: 'i2', bootstrap_id: 'roadmap:phase-2', title: 'Item 2' },
        ],
      },
    });
    renderBlock();
    await waitFor(() => expect(screen.getByTestId('bootstrap-review-block')).toBeTruthy());
    expect(screen.getByTestId('bootstrap-review-block').textContent).toContain('2 stale rows pending review.');
    expect((screen.getByTestId('bootstrap-review-open') as HTMLButtonElement).disabled).toBe(false);
  });

  it('opening the review button mounts the BootstrapReviewModal (review-queue link preserved)', async () => {
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: {
        project_id: 'p1',
        stale: [
          { entity_type: 'item', entity_id: 'i1', bootstrap_id: 'roadmap:phase-1', title: 'Item 1' },
        ],
      },
    });
    renderBlock();
    await waitFor(() => expect(screen.getByTestId('bootstrap-review-block')).toBeTruthy());

    // Modal mocks listBootstrapConflicts again when it opens; pre-stage the response.
    mockApi.listBootstrapConflicts.mockResolvedValueOnce({
      result: {
        project_id: 'p1',
        stale: [
          { entity_type: 'item', entity_id: 'i1', bootstrap_id: 'roadmap:phase-1', title: 'Item 1' },
        ],
      },
    });
    fireEvent.click(screen.getByTestId('bootstrap-review-open'));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
  });

  it('hides the review subsection when the conflicts GET fails (no dangling loading state)', async () => {
    mockApi.listBootstrapConflicts.mockRejectedValueOnce(new Error('boom'));
    renderBlock();
    await waitFor(() => expect(mockApi.listBootstrapConflicts).toHaveBeenCalled());
    expect(screen.queryByTestId('bootstrap-review-block')).toBeNull();
  });
});

describe('BootstrapBlock — Phase 21 render + state + quarantine affordances', () => {
  beforeEach(() => resetMockApi());

  it('hides the render affordance when throughline_status is "absent" (no repo bound)', async () => {
    renderBlock({ throughline_status: 'absent' });
    await waitFor(() => expect(screen.getByTestId('throughline-status')).toBeTruthy());
    expect(screen.queryByTestId('bootstrap-render')).toBeNull();
  });

  it('shows the render button when throughline_status is "complete" and prompt not yet rendered', async () => {
    renderBlock();
    await waitFor(() => expect(screen.getByTestId('bootstrap-render')).toBeTruthy());
    expect(screen.getByTestId('bootstrap-render-button').textContent).toBe('Render bootstrap prompt');
  });

  it('clicking render calls api.renderBootstrapPrompt and displays the invocation command', async () => {
    mockApi.renderBootstrapPrompt.mockResolvedValueOnce({
      result: {
        promptPath: '/tmp/repo/.throughline/bootstrap-prompt.md',
        outputPath: '/tmp/repo/.throughline/bootstrap-output.json',
        bundlePath: '/tmp/methodologies/freeform/bundle.md',
        invocationCommand: 'cat "/tmp/repo/.throughline/bootstrap-prompt.md" | claude',
      },
    });
    renderBlock();
    await waitFor(() => expect(screen.getByTestId('bootstrap-render-button')).toBeTruthy());

    fireEvent.click(screen.getByTestId('bootstrap-render-button'));

    await waitFor(() => expect(screen.getByTestId('bootstrap-invocation-cmd')).toBeTruthy());
    expect(screen.getByTestId('bootstrap-invocation-cmd').textContent).toBe(
      'cat "/tmp/repo/.throughline/bootstrap-prompt.md" | claude',
    );
    expect(mockApi.renderBootstrapPrompt).toHaveBeenCalledWith('p1');
  });

  it('renders an inline error and leaves the button enabled when the render call fails', async () => {
    mockApi.renderBootstrapPrompt.mockRejectedValueOnce(new Error('no_bundle_bound'));
    renderBlock();
    await waitFor(() => expect(screen.getByTestId('bootstrap-render-button')).toBeTruthy());

    fireEvent.click(screen.getByTestId('bootstrap-render-button'));
    await waitFor(() => expect(screen.getByTestId('bootstrap-render-error')).toBeTruthy());
    expect(screen.getByTestId('bootstrap-render-error').textContent).toContain('no_bundle_bound');
    expect((screen.getByTestId('bootstrap-render-button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('displays "Re-render prompt" label when the GET state reports promptRendered=true', async () => {
    mockApi.getBootstrapState.mockResolvedValueOnce({
      result: {
        throughlineDir: 'present',
        promptRendered: true,
        pendingOutput: false,
        lastIngest: null,
        archiveCount: 0,
        quarantineCount: 0,
        promptPath: '/tmp/repo/.throughline/bootstrap-prompt.md',
        outputPath: '/tmp/repo/.throughline/bootstrap-output.json',
      },
    });
    renderBlock();
    await waitFor(() =>
      expect(screen.getByTestId('bootstrap-render-button').textContent).toBe('Re-render prompt'),
    );
  });

  it('renders the last-ingest summary when GET state returns lastIngest', async () => {
    mockApi.getBootstrapState.mockResolvedValueOnce({
      result: {
        throughlineDir: 'present',
        promptRendered: true,
        pendingOutput: false,
        lastIngest: {
          at: '2026-05-28T11:00:00.000Z',
          counts: { new: 5, reimported: 2, conflict: 1, stale_flagged: 0 },
        },
        archiveCount: 1,
        quarantineCount: 0,
        promptPath: '/tmp/repo/.throughline/bootstrap-prompt.md',
        outputPath: '/tmp/repo/.throughline/bootstrap-output.json',
      },
    });
    renderBlock();
    await waitFor(() => expect(screen.getByTestId('bootstrap-last-ingest')).toBeTruthy());
    const text = screen.getByTestId('bootstrap-last-ingest').textContent ?? '';
    expect(text).toContain('5 new');
    expect(text).toContain('2 reimported');
    expect(text).toContain('1 conflict');
    expect(text).toContain('0 stale');
  });

  it('renders the quarantine alert when GET state reports quarantineCount > 0', async () => {
    mockApi.getBootstrapState.mockResolvedValueOnce({
      result: {
        throughlineDir: 'present',
        promptRendered: true,
        pendingOutput: false,
        lastIngest: null,
        archiveCount: 0,
        quarantineCount: 3,
        promptPath: '/tmp/repo/.throughline/bootstrap-prompt.md',
        outputPath: '/tmp/repo/.throughline/bootstrap-output.json',
      },
    });
    renderBlock();
    await waitFor(() => expect(screen.getByTestId('bootstrap-quarantine-alert')).toBeTruthy());
    expect(screen.getByTestId('bootstrap-quarantine-alert').textContent).toContain('3 failed-ingest file');
  });

  it('omits the quarantine alert when quarantineCount is zero', async () => {
    mockApi.getBootstrapState.mockResolvedValueOnce({
      result: {
        throughlineDir: 'present',
        promptRendered: true,
        pendingOutput: false,
        lastIngest: null,
        archiveCount: 0,
        quarantineCount: 0,
        promptPath: '/tmp/repo/.throughline/bootstrap-prompt.md',
        outputPath: '/tmp/repo/.throughline/bootstrap-output.json',
      },
    });
    renderBlock();
    await waitFor(() => expect(mockApi.getBootstrapState).toHaveBeenCalled());
    expect(screen.queryByTestId('bootstrap-quarantine-alert')).toBeNull();
  });

  it('hides the last-ingest summary when GET state has lastIngest=null', async () => {
    renderBlock();
    await waitFor(() => expect(mockApi.getBootstrapState).toHaveBeenCalled());
    expect(screen.queryByTestId('bootstrap-last-ingest')).toBeNull();
  });
});
