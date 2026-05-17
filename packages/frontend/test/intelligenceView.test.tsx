import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { IntelligenceView } from '../src/views/IntelligenceView.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1/intelligence']}>
      <Routes>
        <Route path="/projects/:id/intelligence" element={<IntelligenceView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Phase 14 — Intelligence (RAG) surface', () => {
  beforeEach(() => resetMockApi());

  it('runs a query through the router and renders the answer + citations', async () => {
    renderView();
    fireEvent.change(screen.getByTestId('rag-input'), {
      target: { value: 'where this project stands' },
    });
    fireEvent.click(screen.getByTestId('rag-run'));

    await waitFor(() => expect(screen.getByTestId('rag-result')).toBeTruthy());
    expect(mockApi.ragQuery).toHaveBeenCalledWith('p1', {
      query: 'where this project stands',
      substrate: null,
      cross_project: false,
    });
    expect(screen.getByTestId('rag-answer').textContent).toContain('mock answer');
    expect(screen.getAllByTestId('rag-citation').length).toBe(1);
  });

  it('passes a pinned substrate and cross-project toggle through', async () => {
    renderView();
    fireEvent.change(screen.getByTestId('rag-input'), { target: { value: 'q' } });
    fireEvent.change(screen.getByTestId('rag-substrate'), { target: { value: 'audit' } });
    fireEvent.click(screen.getByTestId('rag-cross'));
    fireEvent.click(screen.getByTestId('rag-run'));

    await waitFor(() => expect(screen.getByTestId('rag-result')).toBeTruthy());
    expect(mockApi.ragQuery).toHaveBeenCalledWith('p1', {
      query: 'q',
      substrate: 'audit',
      cross_project: true,
    });
  });

  it('surfaces an error when the query API throws', async () => {
    mockApi.ragQuery.mockRejectedValueOnce(new Error('network down'));
    renderView();
    fireEvent.change(screen.getByTestId('rag-input'), { target: { value: 'q' } });
    fireEvent.click(screen.getByTestId('rag-run'));
    await waitFor(() => expect(screen.getByTestId('rag-error')).toBeTruthy());
    expect(screen.getByTestId('rag-error').textContent).toContain('network down');
  });

  it('reindex reports the embedder backend', async () => {
    renderView();
    fireEvent.click(screen.getByTestId('rag-reindex'));
    await waitFor(() => expect(screen.getByTestId('rag-reindex-msg')).toBeTruthy());
    expect(screen.getByTestId('rag-reindex-msg').textContent).toContain('fallback');
  });
});
