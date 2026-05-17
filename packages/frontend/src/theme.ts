// Theme application (UI redesign Slice 4). Single place that maps the three
// settings keys onto the <body> data-* attributes the token CSS resolves
// against. Used by main.tsx (early, pre-paint, FOUC-safe) and by App (live,
// on the SSE settings-changed event).

export type ThemeDirection = 'A' | 'B' | 'C';
export type ThemeMode = 'light' | 'dark';
export type ThemeDensity = 'compact' | 'comfortable' | 'spacious';

export interface ThemeSettings {
  direction: ThemeDirection;
  mode: ThemeMode;
  density: ThemeDensity;
}

// Design-handoff v1 default.
export const DEFAULT_THEME: ThemeSettings = {
  direction: 'A',
  mode: 'dark',
  density: 'comfortable',
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

// Normalises a raw /api/settings map (or an SSE settings-changed payload) into
// a validated ThemeSettings, falling back per-key to the v1 default.
export function readTheme(settings: Record<string, unknown> | null | undefined): ThemeSettings {
  const s = settings ?? {};
  return {
    direction: pick(s['theme_direction'], ['A', 'B', 'C'], DEFAULT_THEME.direction),
    mode: pick(s['theme_mode'], ['light', 'dark'], DEFAULT_THEME.mode),
    density: pick(
      s['theme_density'],
      ['compact', 'comfortable', 'spacious'],
      DEFAULT_THEME.density,
    ),
  };
}

export function applyTheme(theme: ThemeSettings): void {
  const { body } = document;
  body.setAttribute('data-direction', theme.direction);
  body.setAttribute('data-theme', theme.mode);
  body.setAttribute('data-density', theme.density);
}
