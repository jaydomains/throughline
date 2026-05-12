import type { Project } from '@throughline/shared';

export interface MethodologySummary {
  status: 'loaded' | 'error';
  bundle_id: string;
  identity?: { name: string; version: string; authority_precedence: string[] };
  errors?: Array<{ bundle_id: string; section?: string; message: string }>;
  // Phase 2 needs to know whether the bundle declares a primary unit (modules view) and
  // whether it declares any gates (methodology-gates view) so the toggle can hide them.
  has_primary_unit?: boolean;
  has_gates?: boolean;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => jsonFetch<{ ok: boolean; version: string }>('/health'),
  listProjects: () => jsonFetch<{ projects: Project[] }>('/api/projects'),
  listMethodologies: () =>
    jsonFetch<{ methodologies: MethodologySummary[] }>('/api/methodologies'),
  switchProject: (id: string) =>
    jsonFetch<{ ok: true }>(`/api/projects/${encodeURIComponent(id)}/switch`, { method: 'POST' }),
  getSettings: () => jsonFetch<{ settings: Record<string, unknown> }>('/api/settings'),
};
