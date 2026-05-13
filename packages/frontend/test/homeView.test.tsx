import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../src/api.js', async () => {
  const { mockApi } = await import('./fixtures/mockApi.js');
  return { api: mockApi };
});

import { HomeView } from '../src/views/stubs.js';
import { mockApi, resetMockApi } from './fixtures/mockApi.js';

beforeEach(() => resetMockApi());

describe('HomeView — code TODO scan (Phase 4)', () => {
  it('clicking the scan button calls the scan endpoint and surfaces the match count', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Routes>
          <Route path="/projects/:id" element={<HomeView />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId('code-todo-scan'));
    await waitFor(() => expect(mockApi.scanCodeTodos).toHaveBeenCalled());
    expect(mockApi.scanCodeTodos.mock.calls[0]![0]).toBe('p1');
    expect(await screen.findByTestId('code-todo-result')).toHaveTextContent('3 matches');
  });
});
