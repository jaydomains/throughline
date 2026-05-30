import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { HomeView } from '../src/views/HomeView.js';
import { mockApi, resetMockApi, seedItem } from './fixtures/mockApi.js';

beforeEach(() => resetMockApi());

function renderHome() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/projects/p1']}>
      <Routes>
        <Route path="/projects/:id" element={<HomeView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomeView surface', () => {
  it('renders the hero and the 4-stat strip', async () => {
    seedItem({ id: 'i1', project_id: 'p1', title: 'Doing thing', status: 'in_progress' });
    seedItem({
      id: 'i2',
      project_id: 'p1',
      title: 'Stuck thing',
      status: 'open',
      blocker_text: 'waiting on review',
    });
    renderHome();

    expect(await screen.findByTestId('home-title')).toHaveTextContent('Across everything');
    await waitFor(() => {
      expect(screen.getByTestId('stat-in-progress')).toHaveTextContent('1');
      expect(screen.getByTestId('stat-blocked')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('stat-drift-signals')).toBeInTheDocument();
    expect(screen.getByTestId('stat-directives')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('inprogress-i1')).toHaveTextContent('Doing thing');
      expect(screen.getByTestId('blocked-i2')).toHaveTextContent('Stuck thing');
    });
  });

  it('the + Capture action links to the capture route', async () => {
    renderHome();
    const capture = await screen.findByRole('link', { name: '+ Capture' });
    expect(capture).toHaveAttribute('href', '/projects/p1/capture');
  });
});

describe('HomeView — code TODO scan (Phase 4 entry point preserved)', () => {
  it('clicking the scan button calls the scan endpoint and surfaces the match count', async () => {
    const user = userEvent.setup();
    renderHome();
    await user.click(screen.getByTestId('code-todo-scan'));
    await waitFor(() => expect(mockApi.scanCodeTodos).toHaveBeenCalled());
    expect(mockApi.scanCodeTodos.mock.calls[0]![0]).toBe('p1');
    expect(await screen.findByTestId('code-todo-result')).toHaveTextContent('3 matches');
  });
});
