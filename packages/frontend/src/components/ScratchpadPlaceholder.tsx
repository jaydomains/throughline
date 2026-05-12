import { useEffect, useRef, useState } from 'react';

// Phase 4 lands real scratchpad behaviour (T-D20). Phase 2 keeps the header anchor
// + collapsible textarea so the layout slot is real.
export function ScratchpadPlaceholder() {
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

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="scratchpad-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Scratchpad
      </button>
      {open && (
        <div className="scratchpad-panel" role="region" aria-label="Scratchpad placeholder">
          <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 6 }}>
            Phase 2 placeholder. Real scratchpad arrives in Phase 4 (T-D20).
          </div>
          <textarea aria-label="Scratchpad" placeholder="(not yet persisted)" />
        </div>
      )}
    </div>
  );
}
