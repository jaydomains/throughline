import type { BundleLoadResult, BundleStructuralError, LoadedBundle } from '@throughline/shared';
import { parseAnchorSystem } from './anchor-system.js';
import { parseAuthorityHierarchy } from './authority-hierarchy.js';
import { parseCommunicationModel } from './communication-model.js';
import { parseGatingModel } from './gating-model.js';
import { parseIdentity } from './identity.js';
import { parseMarkerSystem } from './marker-system.js';
import { parseProjectLayout } from './project-layout.js';
import { parseReviewPatterns } from './review-patterns.js';
import { splitSections } from './sections.js';
import { parseStateMachine } from './state-machine.js';
import { parseTemplates } from './templates.js';
import { parseValidationRules } from './validation-rules.js';

export function parseBundle(bundleId: string, markdown: string): BundleLoadResult {
  const { sections, errors: splitErrors } = splitSections(bundleId, markdown);
  const errors: BundleStructuralError[] = [...splitErrors];

  const identity = parseIdentity(bundleId, sections['1. Identity']);
  const project_layout = parseProjectLayout(bundleId, sections['2. Project layout']);
  const anchor_system = parseAnchorSystem(bundleId, sections['3. Anchor system']);
  const marker_system = parseMarkerSystem(bundleId, sections['4. Marker system']);
  const state_machine = parseStateMachine(bundleId, sections['5. State machine']);
  const communication_model = parseCommunicationModel(bundleId, sections['6. Communication model']);
  const gating_model = parseGatingModel(bundleId, sections['7. Gating model']);
  const review_patterns = parseReviewPatterns(bundleId, sections['8. Review patterns']);
  const templates = parseTemplates(bundleId, sections['9. Templates']);
  const validation_rules = parseValidationRules(bundleId, sections['10. Validation rules']);
  const authority_hierarchy = parseAuthorityHierarchy(bundleId, sections['11. Authority hierarchy']);

  errors.push(
    ...identity.errors,
    ...project_layout.errors,
    ...anchor_system.errors,
    ...marker_system.errors,
    ...state_machine.errors,
    ...communication_model.errors,
    ...gating_model.errors,
    ...review_patterns.errors,
    ...templates.errors,
    ...validation_rules.errors,
    ...authority_hierarchy.errors,
  );

  if (
    errors.length > 0 ||
    !identity.value ||
    !project_layout.value ||
    !anchor_system.value ||
    !marker_system.value ||
    !state_machine.value ||
    !communication_model.value ||
    !gating_model.value ||
    !review_patterns.value ||
    !templates.value ||
    !validation_rules.value ||
    !authority_hierarchy.value
  ) {
    return { status: 'error', bundle_id: bundleId, errors };
  }

  const bundle: LoadedBundle = {
    bundle_id: bundleId,
    identity: identity.value,
    project_layout: project_layout.value,
    anchor_system: anchor_system.value,
    marker_system: marker_system.value,
    state_machine: state_machine.value,
    communication_model: communication_model.value,
    gating_model: gating_model.value,
    review_patterns: review_patterns.value,
    templates: templates.value,
    validation_rules: validation_rules.value,
    authority_hierarchy: authority_hierarchy.value,
  };
  return { status: 'loaded', bundle };
}
