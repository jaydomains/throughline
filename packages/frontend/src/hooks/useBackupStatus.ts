import { useEffect, useState } from 'react';
import type { BackupStatus } from '@throughline/shared';
import { api } from '../api.js';

// Backup indicator (T-D28). Polls status so the header dot turns red once the datastore
// has gone threshold_days without a backup. Slow poll — staleness changes on a daily
// scale, not a second one.
export function useBackupStatus(intervalMs = 60_000): {
  status: BackupStatus | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<BackupStatus | null>(null);

  const load = () => {
    api
      .getBackupStatus()
      .then(setStatus)
      .catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    const tick = () => {
      api
        .getBackupStatus()
        .then((s) => {
          if (alive) setStatus(s);
        })
        .catch(() => {});
    };
    tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [intervalMs]);

  return { status, refresh: load };
}
