// Phase 18 Slice 2 — pure resolver that turns (bundle, modules, repo_path,
// settings) into the `CommunicationModelView` the GET endpoint returns.
// No FS reads, no validation side effects — just path-join + key projection.
// Same posture as Phase 18's overall scope: parse-and-render only.

import path from 'node:path';
import type {
  CommunicationModel,
  CommunicationModelView,
  CommunicationProjectSettings,
  ModulesResult,
} from '@throughline/shared';

export interface ResolveCommunicationViewInput {
  bundle: CommunicationModel;
  declared_tiers: readonly string[];
  modules: ModulesResult;
  repo_path: string;
  settings: CommunicationProjectSettings | undefined;
}

export function resolveCommunicationView(input: ResolveCommunicationViewInput): CommunicationModelView {
  const { bundle, declared_tiers, modules, repo_path, settings } = input;
  const contract_sources = settings?.contract_sources ?? {};
  const module_tiers = settings?.module_tiers ?? {};

  // Resolved contract-sources: one entry per edge type whose §6 declaration carries
  // `contract_source:` (confirmation 5). Absolute paths pass through unchanged;
  // relative paths resolve against the project's repo_path.
  const resolvedContractSources: CommunicationModelView['resolved']['contract_sources'] = {};
  for (const edgeType of bundle.edge_types) {
    if (edgeType.contract_source === null) continue;
    const raw = contract_sources[edgeType.name];
    if (raw === undefined || raw === '') {
      resolvedContractSources[edgeType.name] = { absolute_path: '', configured: false };
    } else {
      const absolute = path.isAbsolute(raw) ? raw : path.resolve(repo_path, raw);
      resolvedContractSources[edgeType.name] = { absolute_path: absolute, configured: true };
    }
  }

  // Resolved module-tiers: one entry per item-derived module (= C-D13 modules service).
  // Empty `modules` (freeform / primary-unit-less / no items yet) yields no entries.
  const tierSet = new Set(declared_tiers);
  const resolvedModuleTiers: CommunicationModelView['resolved']['module_tiers'] = {};
  for (const m of modules.modules) {
    const assigned = module_tiers[m.ref];
    if (assigned === undefined || assigned === '') {
      resolvedModuleTiers[m.ref] = { tier: null, valid: false };
    } else {
      resolvedModuleTiers[m.ref] = { tier: assigned, valid: tierSet.has(assigned) };
    }
  }

  return {
    bundle,
    contract_sources,
    module_tiers,
    resolved: {
      contract_sources: resolvedContractSources,
      module_tiers: resolvedModuleTiers,
      declared_tiers: [...declared_tiers],
    },
  };
}

// Convenience: read the settings sub-block out of a free-form settings_json without
// trusting its shape. Returns undefined when the key is absent or the value is not
// an object.
export function readCommunicationSettings(
  settingsJson: Record<string, unknown>,
): CommunicationProjectSettings | undefined {
  const raw = settingsJson['communication_model'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const out: CommunicationProjectSettings = {};
  if (obj['contract_sources'] && typeof obj['contract_sources'] === 'object' && !Array.isArray(obj['contract_sources'])) {
    out.contract_sources = readStringMap(obj['contract_sources'] as Record<string, unknown>);
  }
  if (obj['module_tiers'] && typeof obj['module_tiers'] === 'object' && !Array.isArray(obj['module_tiers'])) {
    out.module_tiers = readStringMap(obj['module_tiers'] as Record<string, unknown>);
  }
  return out;
}

function readStringMap(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}
