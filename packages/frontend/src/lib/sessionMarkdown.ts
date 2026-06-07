import type { Item } from '@throughline/shared';

// SPEC §7.20 — the per-session markdown fast-path (the shipped v1 export surface).
// Serialise a session and its items into clean, paste-ready markdown formatted for
// paste-back into Claude Code: session name + context, then items grouped by type with
// their status, description, blockers, tags, and branch ref. Pure + deterministic so it is
// unit-testable; the frontend already holds the session + its items, so no backend round-trip.

export interface SessionMarkdownInput {
  name: string;
  context: string | null;
}

function titleCase(s: string): string {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function sessionToMarkdown(session: SessionMarkdownInput, items: Item[]): string {
  const lines: string[] = [];
  const name = session.name.trim() || 'Untitled session';
  lines.push(`# ${name}`);
  lines.push('');
  lines.push(`_Throughline session export — ${items.length} item${items.length === 1 ? '' : 's'}._`);

  const context = session.context?.trim();
  if (context) {
    lines.push('');
    lines.push(context);
  }

  if (items.length === 0) {
    lines.push('');
    lines.push('_No items in this session._');
    return lines.join('\n') + '\n';
  }

  // Resolve structured blocker ids (T-D8) to titles where the blocker is in this session.
  const titleById = new Map(items.map((i) => [i.id, i.title]));

  // Group by item type, preserving first-seen order (mirrors the board layout).
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const g = groups.get(it.type);
    if (g) g.push(it);
    else groups.set(it.type, [it]);
  }

  for (const [type, groupItems] of groups) {
    lines.push('');
    lines.push(`## ${titleCase(type)} (${groupItems.length})`);
    for (const it of groupItems) {
      lines.push('');
      lines.push(`- **${it.title}** — \`${it.status}\``);
      const desc = it.description.trim();
      if (desc) for (const dl of desc.split('\n')) lines.push(`  ${dl}`);
      const blockerText = it.blocker_text?.trim();
      if (blockerText) lines.push(`  - Blocked: ${blockerText}`);
      if (it.blockers.length > 0) {
        const names = it.blockers.map((id) => titleById.get(id) ?? id);
        lines.push(`  - Blocked by: ${names.join(', ')}`);
      }
      if (it.tags.length > 0) {
        lines.push(`  - Tags: ${it.tags.map((t) => `\`${t}\``).join(', ')}`);
      }
      if (it.branch_ref) lines.push(`  - Branch: \`${it.branch_ref}\``);
    }
  }

  return lines.join('\n') + '\n';
}
