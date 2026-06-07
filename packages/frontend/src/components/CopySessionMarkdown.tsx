import { useState } from 'react';
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
  }

  return (
    <button type="button" data-testid="copy-session-markdown" onClick={copy}>
      {state === 'copied' ? 'Copied!' : state === 'error' ? 'Copy failed — retry' : 'Copy as markdown'}
    </button>
  );
}
