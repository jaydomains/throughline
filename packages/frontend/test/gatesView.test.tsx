import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { GatesView } from '../src/views/GatesView.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';
import type { MethodologySummary } from '../src/api.js';

const richSummary: MethodologySummary = {
  status: 'loaded',
  bundle_id: 'rich',
  identity: { name: 'rich', version: '1.0.0', authority_precedence: [] },
  has_primary_unit: true,
  has_gates: true,
};

const freeform: MethodologySummary = {
  status: 'loaded',
  bundle_id: 'freeform',
  identity: { name: 'freeform', version: '1.0.0', authority_precedence: [] },
  has_primary_unit: false,
  has_gates: false,
};

function renderAt(bundle: MethodologySummary, bundleId: string) {
  return render(
    <MemoryRouter initialEntries={['/projects/p1/methodology-gates']}>
      <Routes>
        <Route
          path="/projects/:id/methodology-gates"
          element={<GatesView bundles={[bundle]} projectBundleId={bundleId} />}
        />
        <Route path="/projects/:id" element={<div>home-fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetMockApi();
});

describe('Phase 8 — methodology-gates view', () => {
  it('redirects when the bundle declares no gates (freeform)', () => {
    renderAt(freeform, 'freeform');
    expect(screen.getByText('home-fallback')).toBeInTheDocument();
  });

  it('renders multi-gate moments with per-gate pass/fail (T-D42, T-D44)', async () => {
    mockApi.listGateFirings.mockResolvedValue({
      groups: [
        {
          moment: 'per-commit',
          firings: [
            {
              id: 'f1',
              project_id: 'p1',
              moment: 'per-commit',
              gate_id: 'structure-check',
              status: 'pass',
              findings: { check: 'structural', summary: 'all files present', items: [] },
              created_at: '2026-05-16T00:00:00Z',
            },
            {
              id: 'f2',
              project_id: 'p1',
              moment: 'per-commit',
              gate_id: 'banned-string-sweep',
              status: 'fail',
              findings: {
                check: 'banned-string',
                summary: '1 banned-string occurrence(s)',
                items: [{ message: '"TODO" at line 3', ref: '/repo/SPEC.md' }],
              },
              created_at: '2026-05-16T00:00:00Z',
            },
          ],
        },
      ],
    });
    renderAt(richSummary, 'rich');
    await waitFor(() => expect(screen.getByTestId('view-gates')).toBeInTheDocument());
    expect(screen.getByTestId('gate-status-structure-check')).toHaveTextContent('pass');
    expect(screen.getByTestId('gate-status-banned-string-sweep')).toHaveTextContent('fail');
    expect(screen.getByText('"TODO" at line 3')).toBeInTheDocument();
    // Only the failing gate exposes an override affordance (T-D44).
    expect(screen.getByTestId('override-banned-string-sweep')).toBeInTheDocument();
    expect(screen.queryByTestId('override-structure-check')).not.toBeInTheDocument();
  });

  it('override sends an audit-logged reason and refreshes', async () => {
    mockApi.listGateFirings.mockResolvedValue({
      groups: [
        {
          moment: 'pre-write',
          firings: [
            {
              id: 'f9',
              project_id: 'p1',
              moment: 'pre-write',
              gate_id: 'anchors-resolve',
              status: 'fail',
              findings: { check: 'anchor-resolution', summary: '1 unresolved', items: [] },
              created_at: '2026-05-16T00:00:00Z',
            },
          ],
        },
      ],
    });
    vi.spyOn(window, 'prompt').mockReturnValue('known limitation, shipping anyway');
    renderAt(richSummary, 'rich');
    await waitFor(() => expect(screen.getByTestId('override-anchors-resolve')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('override-anchors-resolve'));
    await waitFor(() =>
      expect(mockApi.overrideGateFiring).toHaveBeenCalledWith(
        'p1',
        'f9',
        'known limitation, shipping anyway',
      ),
    );
  });

  it('fix-and-retry re-runs the moment', async () => {
    mockApi.listGateFirings.mockResolvedValue({
      groups: [{ moment: 'pre-write', firings: [] }],
    });
    renderAt(richSummary, 'rich');
    await waitFor(() => expect(screen.getByTestId('retry-pre-write')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('retry-pre-write'));
    await waitFor(() =>
      expect(mockApi.runGateMoment).toHaveBeenCalledWith('p1', 'pre-write'),
    );
  });

  it('Phase 12 — companion review surface starts a run and renders steps (C-D8)', async () => {
    mockApi.listGateFirings.mockResolvedValue({ groups: [] });
    mockApi.listCompanionChecklists.mockResolvedValue({
      checklists: [
        {
          id: 'review',
          name: 'review',
          steps: [
            { id: 'anchors', kind: 'mechanical', description: 'anchors resolve' },
            { id: 'scope', kind: 'judgement', description: 'scope matches plan' },
          ],
        },
      ],
      companion_modes: [{ id: 'standard', name: 'standard' }],
    });
    mockApi.startCompanionRun.mockResolvedValue({
      run: {
        id: 'r1',
        project_id: 'p1',
        checklist_id: 'review',
        companion_mode: 'standard',
        state: 'running',
        summary_entry_id: null,
        started_at: '2026-05-16T00:00:00Z',
        completed_at: null,
        steps: [
          {
            run_id: 'r1',
            step_id: 'anchors',
            kind: 'mechanical',
            description: 'anchors resolve',
            ordinal: 0,
            state: 'pending',
            findings: { check: '', summary: '', items: [] },
            transitioned_at: '2026-05-16T00:00:00Z',
          },
          {
            run_id: 'r1',
            step_id: 'scope',
            kind: 'judgement',
            description: 'scope matches plan',
            ordinal: 1,
            state: 'pending',
            findings: { check: '', summary: '', items: [] },
            transitioned_at: '2026-05-16T00:00:00Z',
          },
        ],
      },
    });
    renderAt(richSummary, 'rich');
    await waitFor(() =>
      expect(screen.getByTestId('companion-review')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('companion-start'));
    await waitFor(() =>
      expect(mockApi.startCompanionRun).toHaveBeenCalledWith('p1', 'review', null),
    );
    await waitFor(() =>
      expect(screen.getByTestId('companion-step-anchors')).toBeInTheDocument(),
    );
    // Mechanical step exposes "Run check"; judgement step exposes the AI/user panel.
    expect(screen.getByTestId('companion-run-step-anchors')).toBeInTheDocument();
    expect(screen.getByTestId('companion-ai-judge-scope')).toBeInTheDocument();
    expect(screen.getByTestId('companion-judge-scope')).toBeInTheDocument();
  });

  it('Phase 9 — renders category-grouped discipline drift and re-scans (C-D7)', async () => {
    mockApi.getDisciplineDrift.mockResolvedValue({
      groups: [
        {
          category: 'banned-strings',
          signals: [
            {
              id: 'd1',
              project_id: 'p1',
              category: 'banned-strings',
              item_id: null,
              primary_unit_ref: null,
              reason: '"TODO" at line 3 — /repo/SPEC.md',
              created_at: '2026-05-16T00:00:00Z',
            },
          ],
        },
      ],
    });
    mockApi.rescanDisciplineDrift.mockResolvedValue({ groups: [] });
    renderAt(richSummary, 'rich');
    await waitFor(() =>
      expect(screen.getByTestId('drift-category-banned-strings')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('drift-signal-d1')).toHaveTextContent('"TODO" at line 3');
    fireEvent.click(screen.getByTestId('discipline-drift-rescan'));
    await waitFor(() => expect(mockApi.rescanDisciplineDrift).toHaveBeenCalledWith('p1'));
    await waitFor(() =>
      expect(screen.getByTestId('discipline-drift-empty')).toBeInTheDocument(),
    );
  });
});
