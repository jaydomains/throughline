import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityPicker } from '../src/components/EntityPicker.js';

describe('EntityPicker (M-3 — label→UUID picker)', () => {
  it('renders the placeholder + human-readable labels, valued by id', () => {
    render(
      <EntityPicker
        testId="pick"
        value=""
        onChange={() => {}}
        placeholder="Select a session…"
        options={[
          { id: 'sess-9', label: 'Sprint 9' },
          { id: 'sess-3', label: 'Sprint 3' },
        ]}
      />,
    );
    const select = screen.getByTestId('pick') as HTMLSelectElement;
    expect(select.options.length).toBe(3); // placeholder + 2
    expect(select.options[0]?.textContent).toBe('Select a session…');
    expect(screen.getByRole('option', { name: 'Sprint 9' })).toHaveValue('sess-9');
  });

  it('selecting a label fires onChange with the underlying id (UUID), not the label', () => {
    const onChange = vi.fn();
    render(
      <EntityPicker
        testId="pick"
        value=""
        onChange={onChange}
        placeholder="Select an item…"
        options={[{ id: 'item-7', label: 'Item Seven' }]}
      />,
    );
    fireEvent.change(screen.getByTestId('pick'), { target: { value: 'item-7' } });
    expect(onChange).toHaveBeenCalledWith('item-7');
  });
});
