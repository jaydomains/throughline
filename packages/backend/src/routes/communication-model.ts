// Phase 18 Slices 2 + 3 — communication-model view endpoint, per-project
// settings writer, and rule-level graph derivation endpoint.
//
// GET /api/projects/:id/communication-model
//   → { bundle, contract_sources, module_tiers, resolved }
//
// PUT /api/projects/:id/communication-model
//   body: { contract_sources?, module_tiers? }
//   → { settings } (the project's full settings_json after the write)
//
// GET /api/projects/:id/communication-model/graph
//   → { modules, edges, producer_owns_shape }
//
// Replace-semantics on PUT: the body REPLACES the entire `communication_model`
// sub-block in settings_json (matching the wholesale settings_json replace the
// project PATCH path already does in projects/service.ts). Other settings_json
// keys are preserved.

import type { FastifyInstance } from 'fastify';
import type {
  CommunicationGraph,
  CommunicationModelView,
  UpdateCommunicationProjectSettingsInput,
} from '@throughline/shared';
import type { ItemsService } from '../items/service.js';
import { resolveProjectBundle, type MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';
import {
  readCommunicationSettings,
  resolveCommunicationView,
} from '../methodology/communication-model/view.js';
import { deriveCommunicationGraph } from '../methodology/communication-model/graph.js';

interface Deps {
  projects: ProjectsService;
  items: ItemsService;
  registry: MethodologyRegistry;
}

export function registerCommunicationModelRoutes(app: FastifyInstance, deps: Deps): void {
  const { projects, items, registry } = deps;

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/communication-model',
    async (req, reply) => {
      const project = projects.get(req.params.id);
      if (!project) return reply.code(404).send({ error: 'project_not_found' });

      const loaded = resolveProjectBundle(registry, project);
      if (loaded.status !== 'loaded') {
        return reply.code(500).send({ error: 'bundle_not_loaded', bundle_id: project.bundle_id });
      }

      // Modules derive from items' methodology_context.primary_unit_refs (C-D13). For
      // primary-unit-less bundles items.modules returns `{ primary_unit_label: null, modules: [] }`.
      const modules = items.modules(project.id);
      const view: CommunicationModelView = resolveCommunicationView({
        bundle: loaded.bundle.communication_model,
        declared_tiers: loaded.bundle.project_layout.tiers,
        modules,
        repo_path: project.repo_path,
        settings: readCommunicationSettings(project.settings_json),
      });
      return view;
    },
  );

  app.put<{
    Params: { id: string };
    Body: UpdateCommunicationProjectSettingsInput;
  }>(
    '/api/projects/:id/communication-model',
    async (req, reply) => {
      const project = projects.get(req.params.id);
      if (!project) return reply.code(404).send({ error: 'project_not_found' });

      const body = req.body ?? {};
      const block: UpdateCommunicationProjectSettingsInput = {};
      if (body.contract_sources !== undefined) {
        block.contract_sources = filterStringMap(body.contract_sources);
      }
      if (body.module_tiers !== undefined) {
        block.module_tiers = filterStringMap(body.module_tiers);
      }
      const nextSettings = {
        ...project.settings_json,
        communication_model: block,
      };
      const updated = projects.update(project.id, { settings: nextSettings });
      return { settings: updated.settings_json };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/communication-model/graph',
    async (req, reply) => {
      const project = projects.get(req.params.id);
      if (!project) return reply.code(404).send({ error: 'project_not_found' });

      const loaded = resolveProjectBundle(registry, project);
      if (loaded.status !== 'loaded') {
        return reply.code(500).send({ error: 'bundle_not_loaded', bundle_id: project.bundle_id });
      }

      const modules = items.modules(project.id);
      const view: CommunicationModelView = resolveCommunicationView({
        bundle: loaded.bundle.communication_model,
        declared_tiers: loaded.bundle.project_layout.tiers,
        modules,
        repo_path: project.repo_path,
        settings: readCommunicationSettings(project.settings_json),
      });
      const graph: CommunicationGraph = deriveCommunicationGraph({
        bundle: loaded.bundle.communication_model,
        modules,
        module_tiers: view.resolved.module_tiers,
      });
      return graph;
    },
  );
}

// Tolerant filter: drop keys whose value isn't a non-empty string. Callers can
// still send `{ a: '' }` to clear an entry — empty strings drop here too, so the
// stored shape stays clean. The GET path reads either-way via `=== ''` checks.
function filterStringMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.length > 0) out[k] = v;
  }
  return out;
}

