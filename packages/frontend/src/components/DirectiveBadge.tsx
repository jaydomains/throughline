import type { Directive, DirectiveKind } from '@throughline/shared';

interface Props {
  directives: Directive[];
  // When set, clicking the badge fires this callback (e.g., scroll the detail panel to
  // the directives section, or open the modal). Optional — the badge is also useful as
  // a presence indicator with no click affordance.
  onClick?: () => void;
}

const KIND_LABEL: Record<DirectiveKind, string> = {
  pin: 'pinned',
  reminder: 'reminder',
  include_prompt: 'include in prompt',
};

const KIND_GLYPH: Record<DirectiveKind, string> = {
  pin: '📌',
  reminder: '⏰',
  include_prompt: '⊕',
};

// Phase 6b — directive presence indicator. Renders alongside item rows / library entries
// that carry any active directive(s). Tooltip lists each kind so the user gets context
// without opening the detail panel.
export function DirectiveBadge({ directives, onClick }: Props) {
  if (directives.length === 0) return null;
  const kinds = new Set<DirectiveKind>();
  for (const d of directives) kinds.add(d.kind);
  const label = Array.from(kinds).map((k) => KIND_LABEL[k]).join(', ');
  const glyphs = Array.from(kinds).map((k) => KIND_GLYPH[k]).join('');
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      className="directive-badge"
      title={`Directives: ${label}`}
      aria-label={`Directives: ${label}`}
      data-testid="directive-badge"
      {...(onClick ? { onClick, type: 'button' as const } : {})}
    >
      {glyphs}
    </Tag>
  );
}
