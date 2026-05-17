import { describe, it, expect, beforeEach } from 'vitest';
import { readTheme, applyTheme, DEFAULT_THEME } from '../src/theme.js';

describe('theme (UI redesign Slice 4)', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-direction');
    document.body.removeAttribute('data-theme');
    document.body.removeAttribute('data-density');
  });

  it('reads a valid settings map', () => {
    expect(
      readTheme({ theme_direction: 'B', theme_mode: 'light', theme_density: 'spacious' }),
    ).toEqual({ direction: 'B', mode: 'light', density: 'spacious' });
  });

  it('falls back per-key on missing or invalid values', () => {
    expect(readTheme(null)).toEqual(DEFAULT_THEME);
    expect(readTheme({ theme_direction: 'Z', theme_mode: 'dark' })).toEqual({
      direction: DEFAULT_THEME.direction,
      mode: 'dark',
      density: DEFAULT_THEME.density,
    });
  });

  it('applies the theme to body data-* attributes', () => {
    applyTheme({ direction: 'C', mode: 'light', density: 'compact' });
    expect(document.body.getAttribute('data-direction')).toBe('C');
    expect(document.body.getAttribute('data-theme')).toBe('light');
    expect(document.body.getAttribute('data-density')).toBe('compact');
  });
});
