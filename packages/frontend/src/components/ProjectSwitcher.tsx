import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '@throughline/shared';
import { api } from '../api.js';

interface ProjectSwitcherProps {
  projects: Project[];
  activeProjectId: string | null;
}

export function ProjectSwitcher({ projects, activeProjectId }: ProjectSwitcherProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const active = activeProjectId ? projects.find((p) => p.id === activeProjectId) ?? null : null;

  const choose = (p: Project) => {
    setOpen(false);
    // Fire-and-forget — server-side last_active_project_id is a hint, not a barrier.
    void api.switchProject(p.id).catch(() => {});
    navigate(`/projects/${p.id}`);
  };

  return (
    <div className="project-switcher" ref={ref}>
      <button
        type="button"
        className="trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {active ? active.name : 'Select project'} ▾
      </button>
      {open && (
        <div className="menu" role="listbox">
          {projects.length === 0 && <div className="empty">no projects yet</div>}
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === activeProjectId}
              onClick={() => choose(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
