import Fuse from 'fuse.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '@throughline/shared';
import { useModalRegistration } from '../keyboard/modalStack.js';
import { VIEW_MODES, type ViewMode, viewModeVisible } from '../views/modes.js';
import type { MethodologySummary } from '../api.js';
import { findBundle } from '../hooks/useMethodologies.js';

export interface PaletteItem {
  id: string;
  kind: 'project' | 'view' | 'action';
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  bundles: MethodologySummary[];
  activeProjectId: string | null;
}

export function CommandPalette({
  open,
  onClose,
  projects,
  bundles,
  activeProjectId,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useModalRegistration('command-palette', open, onClose);

  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];

    for (const p of projects) {
      out.push({
        id: `project:${p.id}`,
        kind: 'project',
        label: `Open project: ${p.name}`,
        hint: p.bundle_id,
        run: () => {
          navigate(`/projects/${p.id}`);
          onClose();
        },
      });
    }

    const active = activeProjectId ? projects.find((p) => p.id === activeProjectId) ?? null : null;
    const bundle = active ? findBundle(bundles, active.bundle_id) : undefined;

    if (active) {
      for (const v of VIEW_MODES) {
        if (!viewModeVisible(v, bundle)) continue;
        out.push({
          id: `view:${v.id}`,
          kind: 'view',
          label: `View: ${v.label}`,
          hint: active.name,
          run: () => {
            navigate(v.routeFor(active.id));
            onClose();
          },
        });
      }
    }

    out.push({
      id: 'action:projects',
      kind: 'action',
      label: 'Go to projects list',
      run: () => {
        navigate('/projects');
        onClose();
      },
    });

    return out;
  }, [projects, bundles, activeProjectId, navigate, onClose]);

  const fuse = useMemo(
    () => new Fuse(items, { keys: ['label', 'hint'], threshold: 0.4, ignoreLocation: true }),
    [items],
  );

  const visible = useMemo(() => {
    if (!query) return items;
    return fuse.search(query).map((r) => r.item);
  }, [fuse, items, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      // Defer focus so the input is mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const choice = visible[selectedIdx];
      if (choice) choice.run();
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-label="Command palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal palette" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          aria-label="Command palette search"
          placeholder="Search projects, views, actions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul role="listbox">
          {visible.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === selectedIdx}
              onMouseEnter={() => setSelectedIdx(i)}
              onClick={() => item.run()}
            >
              <span>{item.label}</span>
              <span className="kind">{item.hint ?? item.kind}</span>
            </li>
          ))}
          {visible.length === 0 && <li className="kind">no matches</li>}
        </ul>
      </div>
    </div>
  );
}
