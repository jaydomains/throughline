import { useEffect, useRef, useState } from 'react';
import type { Item, Session } from '@throughline/shared';
import { sessionToMarkdown } from '../lib/sessionMarkdown.js';

// SPEC §7.20 fast-path — per-session "Copy as markdown" affordance. Serialises the session
// + its items to markdown (lib/sessionMarkdown) and writes it to the clipboard for paste-back
// into Claude Code. Mirrors the clipboard pattern in PromptFillModal.
export function CopySessionMarkdown({
  session,
  items,
}: {
  session: Session | null;
  items: Item[];
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending reset on unmount so a late setState can't fire after teardown.
  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copy() {
    const md = sessionToMarkdown(
      { name: session?.name ?? '', context: session?.context ?? null },
      items,
    );
    try {
      await navigator.clipboard.writeText(md);
      setState('copied');
    } catch {
      setState('error');
    }
    // Return the label to idle after a moment so a stale "Copied!" doesn't linger
    // (e.g. when the user switches sessions and comes back).
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button type="button" data-testid="copy-session-markdown" onClick={copy}>
      {state === 'copied' ? 'Copied!' : state === 'error' ? 'Copy failed — retry' : 'Copy as markdown'}
    </button>
  );
}
