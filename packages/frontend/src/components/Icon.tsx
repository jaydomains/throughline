// 15-glyph inline-SVG icon set (design handoff). Line icons only — 1.25
// stroke, currentColor, round caps/joins, no fills. Ported from
// prototype/icons.jsx. 16×16 viewBox, rendered at `size` px (default 14).

export type IconName =
  | 'home'
  | 'session'
  | 'tree'
  | 'graph'
  | 'library'
  | 'gate'
  | 'drift'
  | 'directives'
  | 'modules'
  | 'settings'
  | 'search'
  | 'note'
  | 'prompt'
  | 'item'
  | 'action'
  | 'view'
  | 'project'
  | 'chevron'
  | 'chevron-down'
  | 'clock'
  | 'flag'
  | 'spark'
  | 'check'
  | 'x'
  | 'cmd';

interface IconProps {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 14 }: IconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M2 7l6-5 6 5v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7Z" />
          <path d="M6 15v-5h4v5" />
        </svg>
      );
    case 'session':
      return (
        <svg {...props}>
          <rect x="2" y="3" width="12" height="10" rx="1" />
          <path d="M2 6h12" />
          <path d="M5 9h3" />
          <path d="M5 11h6" />
        </svg>
      );
    case 'tree':
      return (
        <svg {...props}>
          <path d="M3 3v4" />
          <path d="M3 7h4" />
          <path d="M3 7v4" />
          <path d="M3 11h4" />
          <circle cx="9" cy="3" r="1" />
          <circle cx="9" cy="7" r="1" />
          <circle cx="9" cy="11" r="1" />
        </svg>
      );
    case 'graph':
      return (
        <svg {...props}>
          <circle cx="3" cy="4" r="1.5" />
          <circle cx="13" cy="4" r="1.5" />
          <circle cx="8" cy="12" r="1.5" />
          <path d="M4 5l3.5 6" />
          <path d="M12 5l-3.5 6" />
        </svg>
      );
    case 'library':
      return (
        <svg {...props}>
          <path d="M3 3v10a1 1 0 0 0 1 1h2V3H4a1 1 0 0 0-1 1Z" />
          <path d="M6 3h4v11H6z" />
          <path d="M10 4l3 .5L11.5 13l-3-.5z" />
        </svg>
      );
    case 'gate':
      return (
        <svg {...props}>
          <path d="M2 8l3-4h6l3 4-3 4H5z" />
          <path d="M5 4v8" />
          <path d="M11 4v8" />
        </svg>
      );
    case 'drift':
      return (
        <svg {...props}>
          <path d="M2 12l3-7 3 4 3-2 3 5" />
          <circle cx="5" cy="5" r="1" />
          <circle cx="11" cy="7" r="1" />
        </svg>
      );
    case 'directives':
      return (
        <svg {...props}>
          <circle cx="8" cy="3" r="1" />
          <circle cx="8" cy="8" r="1" />
          <circle cx="8" cy="13" r="1" />
        </svg>
      );
    case 'modules':
      return (
        <svg {...props}>
          <rect x="2" y="2" width="5" height="5" />
          <rect x="9" y="2" width="5" height="5" />
          <rect x="2" y="9" width="5" height="5" />
          <rect x="9" y="9" width="5" height="5" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="2" />
          <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5l3 3" />
        </svg>
      );
    case 'note':
      return (
        <svg {...props}>
          <path d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3z" />
          <path d="M10 2v3h3" />
          <path d="M5 8h6M5 10h6M5 12h4" />
        </svg>
      );
    case 'prompt':
      return (
        <svg {...props}>
          <path d="M2 5l3 3-3 3" />
          <path d="M8 11h6" />
        </svg>
      );
    case 'item':
      return (
        <svg {...props}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
          <path d="M5 8l2 2 4-4" />
        </svg>
      );
    case 'action':
      return (
        <svg {...props}>
          <path d="M3 8h10" />
          <path d="M9 4l4 4-4 4" />
        </svg>
      );
    case 'view':
      return (
        <svg {...props}>
          <rect x="2" y="3" width="12" height="10" rx="1" />
          <path d="M2 7h12" />
        </svg>
      );
    case 'project':
      return (
        <svg {...props}>
          <path d="M2 4a1 1 0 0 1 1-1h3l1 1.5h6a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...props}>
          <path d="M5 4l4 4-4 4" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...props}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4v4l2.5 1.5" />
        </svg>
      );
    case 'flag':
      return (
        <svg {...props}>
          <path d="M4 14V2" />
          <path d="M4 3h8l-2 3 2 3H4" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...props}>
          <path d="M8 2v3M8 11v3M2 8h3M11 8h3M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M3 8l3.5 3.5L13 5" />
        </svg>
      );
    case 'x':
      return (
        <svg {...props}>
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      );
    case 'cmd':
      return (
        <svg {...props} strokeWidth={1.4}>
          <path d="M4 3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h8a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2Z" />
        </svg>
      );
    default:
      return null;
  }
}
