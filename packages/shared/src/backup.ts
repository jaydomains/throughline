// Backup (T-D28, CODE_SPEC §17). Single-file datastore snapshot + optional auto-copy.
// API keys (T-D4) and the install-shipped methodologies/ directory are never part of
// a snapshot — they live outside the datastore by construction.

export interface BackupStatus {
  // ISO timestamp of the most recent successful export or auto-copy; null if never.
  last_backup_at: string | null;
  // Days without a backup before the header indicator turns red (default 7, CODE_SPEC §17).
  threshold_days: number;
  // True once (now - last_backup_at) exceeds threshold_days, or when never backed up.
  stale: boolean;
  // The configured off-disk auto-copy target, or null when unset. When null, snapshots
  // stay local-only — a laptop wipe loses everything. The settings panel surfaces this.
  auto_copy_target_path: string | null;
  // Timestamp of the last successful auto-copy, or null. Distinct from last_backup_at
  // so the panel can tell "you exported manually" from "off-disk copy succeeded".
  last_auto_copy_at: string | null;
}
