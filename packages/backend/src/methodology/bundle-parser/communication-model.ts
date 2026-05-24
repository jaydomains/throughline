// T-D49 — §6 Communication model parser. H3 walker pattern, same shape as
// state-machine.ts's `### Item type:` / `### Gates:`. Accepts three sub-section
// kinds:
//
//   ### Edge type: <name>
//   when: <tier-a> <-> <tier-b>   (or "any")
//   mechanism: direct              (or "via <module-id>")
//   contract_source: <slug>        (optional)
//   invariant: violation           (optional; parsed, not enforced — T-D50)
//
//   ### Tier routing: <tier-name>
//   mechanism: direct              (or "via <module-id>")
//   note: <free text>              (optional)
//
//   ### Producer ownership
//   rule: producer-owns-shape
//   notes: <free text>             (optional)
//
// Tier names referenced in `when:` and `### Tier routing:` resolve against §2
// Project layout's `tiers:` vocabulary. Unknown tier names raise at parse time
// (Phase 18 sharpening confirmation 1) — not lazily at derivation, not at
// bundle-load assembly.

import type {
  BundleStructuralError,
  CommunicationEdgeType,
  CommunicationModel,
  Mechanism,
  ProducerOwnership,
  TierPair,
  TierRoutingRule,
} from '@throughline/shared';
import { isNoneBody, parseKeyValueLines } from './sections.js';

const SECTION = '6. Communication model';

export interface CommunicationModelParseResult {
  value?: CommunicationModel;
  errors: BundleStructuralError[];
}

function parseMechanism(
  raw: string | undefined,
  context: string,
  bundleId: string,
  errors: BundleStructuralError[],
): Mechanism | null {
  if (!raw) {
    errors.push({ bundle_id: bundleId, section: SECTION, message: `${context}: missing mechanism.` });
    return null;
  }
  const trimmed = raw.trim();
  if (/^direct$/i.test(trimmed)) return { kind: 'direct' };
  const via = /^via\s+(\S.*?)$/i.exec(trimmed);
  if (via && via[1]) return { kind: 'via', module_id: via[1].trim() };
  errors.push({
    bundle_id: bundleId,
    section: SECTION,
    message: `${context}: mechanism must be "direct" or "via <module-id>" (got "${trimmed}").`,
  });
  return null;
}

function parseWhen(
  raw: string | undefined,
  context: string,
  bundleId: string,
  tiers: ReadonlySet<string>,
  errors: BundleStructuralError[],
): TierPair | null {
  if (!raw) {
    errors.push({ bundle_id: bundleId, section: SECTION, message: `${context}: missing when.` });
    return null;
  }
  const trimmed = raw.trim();
  if (/^any$/i.test(trimmed)) return { kind: 'any' };
  const parts = trimmed.split(/<->|↔/).map((s) => s.trim()).filter(Boolean);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    errors.push({
      bundle_id: bundleId,
      section: SECTION,
      message: `${context}: when must be "<tier> <-> <tier>" or "any" (got "${trimmed}").`,
    });
    return null;
  }
  const [a, b] = parts;
  let ok = true;
  for (const t of [a, b]) {
    if (!tiers.has(t)) {
      errors.push({
        bundle_id: bundleId,
        section: SECTION,
        message: `${context}: tier "${t}" is not declared in §2 Project layout (tiers: …).`,
      });
      ok = false;
    }
  }
  return ok ? { kind: 'pair', a, b } : null;
}

interface H3Region {
  heading: string;
  body: string;
}

function splitH3Regions(body: string): H3Region[] {
  const pattern = /^###\s+(.+?)\s*$/gim;
  const heads: Array<{ heading: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(body)) !== null) {
    const heading = m[1]?.trim();
    if (heading) heads.push({ heading, index: m.index });
  }
  const out: H3Region[] = [];
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i]!.index;
    const end = heads[i + 1]?.index ?? body.length;
    const slice = body.slice(start, end);
    const firstNl = slice.indexOf('\n');
    const sub = firstNl >= 0 ? slice.slice(firstNl + 1) : '';
    out.push({ heading: heads[i]!.heading, body: sub });
  }
  return out;
}

export function parseCommunicationModel(
  bundleId: string,
  body: string,
  tiersList: readonly string[] = [],
): CommunicationModelParseResult {
  if (isNoneBody(body)) {
    return {
      value: { status: 'none', edge_types: [], tier_routing: [], producer_ownership: null },
      errors: [],
    };
  }

  const errors: BundleStructuralError[] = [];
  const tiers = new Set(tiersList);
  const regions = splitH3Regions(body);

  const edge_types: CommunicationEdgeType[] = [];
  const seen_edge_names = new Set<string>();
  const tier_routing: TierRoutingRule[] = [];
  let producer_ownership: ProducerOwnership | null = null;

  for (const region of regions) {
    const edgeMatch = /^Edge type:\s+(.+)$/i.exec(region.heading);
    const tierRouteMatch = /^Tier routing:\s+(.+)$/i.exec(region.heading);
    const producerMatch = /^Producer ownership\s*$/i.exec(region.heading);

    if (edgeMatch) {
      const name = edgeMatch[1]!.trim();
      const context = `Edge type "${name}"`;
      if (seen_edge_names.has(name)) {
        errors.push({
          bundle_id: bundleId,
          section: SECTION,
          message: `${context}: duplicate edge-type name.`,
        });
        continue;
      }
      seen_edge_names.add(name);
      const kv = parseKeyValueLines(region.body);
      // "Both direct and via" — caught before parseMechanism so the error message names
      // the precise grammar violation rather than the downstream "doesn't match" fallback.
      const mechRaw = kv['mechanism']?.trim() ?? '';
      if (/\bdirect\b/i.test(mechRaw) && /\bvia\b/i.test(mechRaw)) {
        errors.push({
          bundle_id: bundleId,
          section: SECTION,
          message: `${context}: mechanism cannot be both "direct" and "via …".`,
        });
        continue;
      }
      const when = parseWhen(kv['when'], context, bundleId, tiers, errors);
      const mechanism = parseMechanism(kv['mechanism'], context, bundleId, errors);
      if (!when || !mechanism) continue;
      const contract_source = kv['contract_source']?.trim() || null;
      const invariantRaw = kv['invariant']?.trim().toLowerCase();
      const invariant: 'violation' | null = invariantRaw === 'violation' ? 'violation' : null;
      edge_types.push({ name, when, mechanism, contract_source, invariant });
      continue;
    }

    if (tierRouteMatch) {
      const tier = tierRouteMatch[1]!.trim();
      const context = `Tier routing "${tier}"`;
      if (!tiers.has(tier)) {
        errors.push({
          bundle_id: bundleId,
          section: SECTION,
          message: `${context}: tier "${tier}" is not declared in §2 Project layout (tiers: …).`,
        });
        continue;
      }
      const kv = parseKeyValueLines(region.body);
      const mechanism = parseMechanism(kv['mechanism'], context, bundleId, errors);
      if (!mechanism) continue;
      tier_routing.push({ tier, mechanism, note: kv['note']?.trim() || null });
      continue;
    }

    if (producerMatch) {
      const kv = parseKeyValueLines(region.body);
      const rule = kv['rule']?.trim();
      if (rule !== 'producer-owns-shape') {
        errors.push({
          bundle_id: bundleId,
          section: SECTION,
          message: `Producer ownership: rule must be "producer-owns-shape" (got "${rule ?? '<missing>'}").`,
        });
        continue;
      }
      producer_ownership = { rule: 'producer-owns-shape', notes: kv['notes']?.trim() || null };
      continue;
    }

    errors.push({
      bundle_id: bundleId,
      section: SECTION,
      message: `Unknown sub-section "${region.heading}". Expected "Edge type: <name>" / "Tier routing: <tier>" / "Producer ownership".`,
    });
  }

  if (errors.length > 0) return { errors };

  return {
    value: { status: 'declared', edge_types, tier_routing, producer_ownership },
    errors: [],
  };
}
