import { useMemo } from 'react';
import type { BackupStatus } from '@throughline/shared';
import { api } from '../api.js';
import { usePolledResource } from './useResource.js';

// Backup indicator (T-D28). Polls status so the header dot turns red once the datastore
// has gone threshold_days without a backup. Slow poll — staleness changes on a daily
// scale, not a second one.
//
// Built on usePolledResource (C-D24): a failed poll now surfaces an `error` rather than
// being swallowed by a silent `.catch(() => {})`.
export function useBackupStatus(intervalMs = 60_000): {
  status: BackupStatus | null;
  error: Error | null;
  refresh: () => void;
} {
  const fetcher = useMemo<() => Promise<BackupStatus | null>>(() => () => api.getBackupStatus(), []);
  const { data, error, refresh } = usePolledResource<BackupStatus | null>(fetcher, null, intervalMs);
  return { status: data, error, refresh };
}
