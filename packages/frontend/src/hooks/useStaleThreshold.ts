import { useEffect, useState } from 'react';
import { api } from '../api.js';

const DEFAULT_DAYS = 14;

export function useStaleThreshold(): number {
  const [days, setDays] = useState<number>(DEFAULT_DAYS);
  useEffect(() => {
    let alive = true;
    api
      .getSettings()
      .then((r) => {
        const v = r.settings['stale_threshold_days'];
        if (alive && typeof v === 'number' && Number.isFinite(v) && v > 0) setDays(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return days;
}

export function isStale(updatedAt: string, days: number, now = Date.now()): boolean {
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return false;
  return now - t > days * 24 * 60 * 60 * 1000;
}
