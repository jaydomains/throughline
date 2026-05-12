import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Central key-binding registry. Phase 2 wires the global bindings (Cmd/Ctrl+K,
// Esc, ?). Phase 3+ adds list-row consumers (arrow nav, Tab/Shift-Tab indent).
// Keeping the registry centralised so the `?` help modal can reflect what's bound.

export interface Binding {
  id: string;
  combo: string; // human-readable, for the help modal
  description: string;
  scope?: 'global' | 'palette' | 'list';
}

interface KeyboardCtx {
  bindings: Binding[];
  register: (b: Binding) => () => void;
}

const Ctx = createContext<KeyboardCtx | null>(null);

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [bindings, setBindings] = useState<Binding[]>([]);
  const counter = useRef(0);

  const register = useCallback((b: Binding) => {
    counter.current += 1;
    setBindings((prev) => [...prev, b]);
    return () => {
      setBindings((prev) => prev.filter((x) => x.id !== b.id));
    };
  }, []);

  const value = useMemo<KeyboardCtx>(() => ({ bindings, register }), [bindings, register]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useKeyboardRegistry(): KeyboardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('KeyboardProvider missing');
  return ctx;
}
