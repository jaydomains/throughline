import { useEffect } from 'react';

export interface HotkeyOptions {
  // If true, the hotkey fires even when focus is inside an input/textarea.
  allowInInput?: boolean;
}

// Minimal hotkey hook. Modifiers in the combo are required; unstated modifiers
// are "don't care" — this matches common hotkey-library conventions and avoids
// false negatives on shifted-punctuation keys (e.g. `?` requires Shift on most
// layouts, but a binding written as `?` should still fire).
// Modifier aliases: `mod` matches Cmd on mac, Ctrl elsewhere.
export function useHotkey(
  combo: string,
  handler: (ev: KeyboardEvent) => void,
  opts: HotkeyOptions = {},
): void {
  useEffect(() => {
    const onKey = (e: Event) => {
      const ev = e as KeyboardEvent;
      if (!opts.allowInInput && isEditable(ev.target)) return;
      if (matches(ev, combo)) {
        handler(ev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, handler, opts.allowInInput]);
}

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}

function matches(ev: KeyboardEvent, combo: string): boolean {
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  const key = parts[parts.length - 1];
  if (!key) return false;
  if (ev.key.toLowerCase() !== key) return false;

  const wantMod = parts.includes('mod');
  const wantCtrl = parts.includes('ctrl');
  const wantMeta = parts.includes('meta') || parts.includes('cmd');
  const wantShift = parts.includes('shift');
  const wantAlt = parts.includes('alt');

  if (wantMod) {
    if (!(ev.metaKey || ev.ctrlKey)) return false;
  } else {
    if (wantCtrl && !ev.ctrlKey) return false;
    if (wantMeta && !ev.metaKey) return false;
  }
  if (wantShift && !ev.shiftKey) return false;
  if (wantAlt && !ev.altKey) return false;
  return true;
}
