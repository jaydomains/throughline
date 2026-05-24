// Phase 18 Slice 2 — per-project view of the communication model.
//
// Two halves:
// 1. The bundle's §6 declarations (already parsed in Slice 1 — `CommunicationModel`).
// 2. The project's settings: which path each `contract_source`-declaring edge type
//    resolves to on disk, and which architectural tier each item-derived module
//    belongs to. Same bundle-declares / project-supplies split as bundle_id / bundle_path
//    (C-D14).
//
// Phase 18 ships parse-and-render only — `resolved.contract_sources[*].absolute_path`
// is computed by path-join; nothing reads contract files yet.

import type { CommunicationModel } from './bundle.js';

// Lives under `projects.settings_json.communication_model`. Both fields optional —
// a project may have configured neither, one, or both.
export interface CommunicationProjectSettings {
  // edge-type-name -> repo-relative-or-absolute path. Only edge types whose §6
  // declaration carries `contract_source:` are surfaced in the view's `resolved`
  // block, per Phase 18 sharpening confirmation 5.
  contract_sources?: Record<string, string>;
  // module-name -> tier-name (one of bundle.project_layout.tiers). Module names are
  // the strings present in items' methodology_context.primary_unit_refs.
  module_tiers?: Record<string, string>;
}

// View endpoint response.
export interface CommunicationModelView {
  bundle: CommunicationModel;
  // Raw settings as stored — handy for round-trip diffing in the UI.
  contract_sources: Record<string, string>;
  module_tiers: Record<string, string>;
  resolved: {
    // One entry per edge type whose §6 declaration includes `contract_source:`.
    // `configured: false` means the project has not set a path; `absolute_path`
    // is the empty string in that case.
    contract_sources: Record<string, { absolute_path: string; configured: boolean }>;
    // One entry per module name discovered in the project's items. `tier` is the
    // assigned value or null (unassigned); `valid` is true iff `tier` is in
    // `declared_tiers` (false includes the unassigned case).
    module_tiers: Record<string, { tier: string | null; valid: boolean }>;
    // §2 Project layout's `tiers:` vocabulary, surfaced so the frontend can render
    // a tier-picker dropdown without a second round-trip.
    declared_tiers: string[];
  };
}

// PUT body: replaces the entire `communication_model` sub-block in settings_json.
// Either field omitted → cleared. Mirrors the simple replace-semantics of the
// project PATCH path (projects/service.ts update: settings_json is replaced wholesale,
// not merged).
export interface UpdateCommunicationProjectSettingsInput {
  contract_sources?: Record<string, string>;
  module_tiers?: Record<string, string>;
}
