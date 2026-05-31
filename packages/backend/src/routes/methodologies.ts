import type { FastifyInstance } from 'fastify';
import type { MethodologiesResponse, MethodologyHealthResult } from '@throughline/shared';
import { ProjectNotFoundError } from '@throughline/shared';
import type { MethodologyRegistry } from '../methodology/loader.js';
import type { ProjectsService } from '../projects/service.js';
import { resolveProjectBundle } from '../methodology/loader.js';

export function registerMethodologyRoutes(
  app: FastifyInstance,
  registry: MethodologyRegistry,
  projects: ProjectsService,
): void {
  // SF2-02 / SF2-06 (E6, C-D25): per-project methodology bundle health. Resolves the
  // project's ACTUAL bundle through the C-D14/C-D19 precedence (external path → per-repo →
  // install-shipped), so a bound-but-broken bundle is reported 'degraded' (distinct from a
  // legitimate freeform project, 'absent') — the distinction `runGates` erased by returning
  // [] for both. Because it resolves the project's real bundle, an external/per-repo bundle
  // error is surfaced here too, which the install-cache-only GET /api/methodologies cannot.
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/methodology-health',
    async (req): Promise<MethodologyHealthResult> => {
      const project = projects.get(req.params.id);
      if (!project) throw new ProjectNotFoundError(req.params.id);
      const resolved = resolveProjectBundle(registry, project);
      if (resolved.status === 'error') {
        return { state: 'degraded', bundle_id: project.bundle_id, errors: resolved.errors };
      }
      // Loaded: a bundle with no gates and no primary unit is a legitimate freeform setup
      // ('absent' — no methodology capability in play, working as intended); anything with
      // methodology machinery is 'healthy'.
      const gateCount = Object.values(resolved.bundle.state_machine.gates_by_moment).reduce(
        (n, gates) => n + (gates?.length ?? 0),
        0,
      );
      const hasMethodology = gateCount > 0 || resolved.bundle.project_layout.primary_unit !== null;
      return {
        state: hasMethodology ? 'healthy' : 'absent',
        bundle_id: resolved.bundle.bundle_id,
      };
    },
  );

  app.get('/api/methodologies', async (): Promise<MethodologiesResponse> => {
    return {
      methodologies: registry.list().map((result) => {
        if (result.status === 'loaded') {
          const gateCount = Object.values(result.bundle.state_machine.gates_by_moment).reduce(
            (n, gates) => n + (gates?.length ?? 0),
            0,
          );
          return {
            status: 'loaded' as const,
            bundle_id: result.bundle.bundle_id,
            identity: result.bundle.identity,
            has_primary_unit: result.bundle.project_layout.primary_unit !== null,
            has_gates: gateCount > 0,
          };
        }
        return {
          status: 'error' as const,
          bundle_id: result.bundle_id,
          errors: result.errors,
        };
      }),
    };
  });
}
