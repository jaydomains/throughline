import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Polls /health every 10s. Combined with SSE liveness, the banner clears whenever
// either signal recovers.
//
// Deliberately NOT built on usePolledResource (C-D24): here a failed request IS the
// datum — it maps to `healthy: false` (the banner) rather than to an `error` slot. The
// usePolledResource contract treats a rejection as an error to surface, which is the
// opposite of what a liveness probe wants.
export function useBackendHealth(intervalMs = 10_000): { healthy: boolean | null } {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      api
        .health()
        .then(() => {
          if (alive) setHealthy(true);
        })
        .catch(() => {
          if (alive) setHealthy(false);
        });
    };
    tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [intervalMs]);

  return { healthy };
}
