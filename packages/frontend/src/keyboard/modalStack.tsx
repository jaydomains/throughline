import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Simple modal stack so global Esc closes only the top modal and palette/help
// don't fight each other.

interface ModalStackCtx {
  push: (id: string, onClose: () => void) => () => void;
  topId: string | null;
  closeTop: () => void;
}

const Ctx = createContext<ModalStackCtx | null>(null);

interface Entry {
  id: string;
  onClose: () => void;
}

export function ModalStackProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<Entry[]>([]);
  const [topId, setTopId] = useState<string | null>(null);

  const sync = useCallback(() => {
    const top = stackRef.current[stackRef.current.length - 1];
    setTopId(top ? top.id : null);
  }, []);

  const push = useCallback(
    (id: string, onClose: () => void) => {
      stackRef.current.push({ id, onClose });
      sync();
      return () => {
        stackRef.current = stackRef.current.filter((e) => e.id !== id);
        sync();
      };
    },
    [sync],
  );

  const closeTop = useCallback(() => {
    const top = stackRef.current[stackRef.current.length - 1];
    if (top) top.onClose();
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        const top = stackRef.current[stackRef.current.length - 1];
        if (top) {
          ev.preventDefault();
          top.onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo<ModalStackCtx>(() => ({ push, topId, closeTop }), [push, topId, closeTop]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useModalStack(): ModalStackCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('ModalStackProvider missing');
  return ctx;
}

export function useModalRegistration(id: string, open: boolean, onClose: () => void): void {
  const stack = useModalStack();
  useEffect(() => {
    if (!open) return;
    return stack.push(id, onClose);
  }, [id, open, onClose, stack]);
}
