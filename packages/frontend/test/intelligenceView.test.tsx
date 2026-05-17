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

  it('generates an end-of-session retro with attach + append flags', async () => {
    renderView();
    fireEvent.change(screen.getByTestId('retro-session'), { target: { value: 'sess-9' } });
    fireEvent.click(screen.getByTestId('retro-attach'));
    fireEvent.click(screen.getByTestId('retro-append'));
    fireEvent.click(screen.getByTestId('retro-run'));
    await waitFor(() => expect(screen.getByTestId('retro-msg')).toBeTruthy());
    expect(mockApi.sessionRetro).toHaveBeenCalledWith('p1', {
      session_id: 'sess-9',
      attach_to_items: true,
      append_to_session_start: true,
    });
    expect(screen.getByTestId('retro-msg').textContent).toContain('appended to session-start.md');
  });

  it('loads periodic-review hygiene buckets and synthesises on demand', async () => {
    renderView();
    await waitFor(() => expect(screen.getByTestId('periodic-review')).toBeTruthy());
    expect(screen.getByTestId('review-due').textContent).toContain('due');
    expect(screen.getByTestId('bucket-code-drift').textContent).toContain('1');
    fireEvent.click(screen.getByTestId('review-synth'));
    await waitFor(() => expect(screen.getByTestId('review-synthesis')).toBeTruthy());
    expect(screen.getByTestId('review-synthesis').textContent).toContain('tier-2');
    expect(mockApi.synthesizePeriodicReview).toHaveBeenCalledWith('p1');
  });

  it('loads the Do-next sequence with unblock-impact summary', async () => {
    renderView();
    await waitFor(() => expect(screen.getByTestId('do-next')).toBeTruthy());
    expect(screen.getByTestId('unblock-impact').textContent).toContain('2 items become unblocked');
    expect(screen.getByTestId('do-next-c').textContent).toContain('frees 2');
  });

  it('renders a stakeholder view for an item id', async () => {
    renderView();
    fireEvent.change(screen.getByTestId('stake-item'), { target: { value: 'item-7' } });
    fireEvent.click(screen.getByTestId('stake-run'));
    await waitFor(() => expect(screen.getByTestId('stake-result')).toBeTruthy());
    expect(mockApi.getStakeholderView).toHaveBeenCalledWith('p1', 'item-7');
    expect(screen.getByTestId('stake-result').textContent).toContain('Plain-language summary of item-7');
  });

  it('sends a per-list chat turn and appends the exchange to the log', async () => {
    renderView();
    fireEvent.change(screen.getByTestId('chat-ctx-id'), { target: { value: 'sess-3' } });
    fireEvent.change(screen.getByTestId('chat-input'), {
      target: { value: 'what should I do next' },
    });
    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() =>
      expect(screen.getByTestId('chat-log').textContent).toContain('re: what should I do next'),
    );
    expect(mockApi.sendChat).toHaveBeenCalledWith('p1', {
      context_type: 'session',
      context_id: 'sess-3',
      message: 'what should I do next',
    });
  });

  it('loads persisted chat history for a context', async () => {
    mockApi.getChatHistory.mockResolvedValueOnce({
      context_type: 'dump_zone',
      context_id: 'p1',
      messages: [{ id: 'm1', role: 'user', content: 'earlier note', created_at: 't' }],
    });
    renderView();
    fireEvent.change(screen.getByTestId('chat-ctx-type'), { target: { value: 'dump_zone' } });
    fireEvent.change(screen.getByTestId('chat-ctx-id'), { target: { value: 'p1' } });
    fireEvent.click(screen.getByTestId('chat-load'));
    await waitFor(() =>
      expect(screen.getByTestId('chat-log').textContent).toContain('earlier note'),
    );
    expect(mockApi.getChatHistory).toHaveBeenCalledWith('p1', 'dump_zone', 'p1');
  });
});
