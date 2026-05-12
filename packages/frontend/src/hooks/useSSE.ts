import { useEffect, useRef, useState } from 'react';

export interface SSEState {
  connected: boolean;
  lastPingAt: number | null;
  lastEvent: { type: string; data: unknown } | null;
}

// Phase 2 establishes the channel. Producers (drift signals, gate firings,
// cost meter, bundle reloads) wire in later phases.
export function useSSE(url = '/events'): SSEState {
  const [connected, setConnected] = useState(false);
  const [lastPingAt, setLastPingAt] = useState<number | null>(null);
  const [lastEvent, setLastEvent] = useState<{ type: string; data: unknown } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('welcome', (ev) => {
      const evt = ev as MessageEvent;
      setLastEvent({ type: 'welcome', data: safeParse(evt.data) });
    });
    es.addEventListener('ping', (ev) => {
      const evt = ev as MessageEvent;
      setLastPingAt(Date.now());
      setLastEvent({ type: 'ping', data: safeParse(evt.data) });
    });

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [url]);

  return { connected, lastPingAt, lastEvent };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return s;
  }
}
