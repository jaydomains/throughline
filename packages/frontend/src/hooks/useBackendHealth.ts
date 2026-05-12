import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Polls /health every 10s. Combined with SSE liveness, the banner clears whenever
// either signal recovers.
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
